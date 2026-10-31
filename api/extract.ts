import type { IncomingMessage, ServerResponse } from 'http';
import { createHash, randomUUID } from 'crypto';
import {
  MAX_EXTRACT_BODY_SIZE,
  readJsonBody,
  sendError,
  sendJson,
  getClientIp,
} from './_lib/http.js';
import { extractRateLimiter } from './_lib/rateLimit.js';
import { getGeminiClient, GeminiServiceError } from './_lib/gemini.js';
import {
  buildExtractionPrompt,
  EXTRACTION_RESPONSE_SCHEMA,
  EXTRACTION_SYSTEM_INSTRUCTION,
} from './_lib/prompts.js';
import {
  ExtractRequestSchema,
  GeminiExtractItemSchema,
  isValidCalendarDate,
  isValidTime,
  Category,
  CATEGORIES,
  DraftNotice,
} from '../shared/schema.js';
import { calendarDaysDifference } from '../shared/dates.js';

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function sanitizeString(str: string | null | undefined, maxLen: number): string | null {
  if (typeof str !== 'string') return null;
  const stripped = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  return stripped.length === 0 ? null : stripped.slice(0, maxLen);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 1. Method check
  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST requests are allowed');
  }

  // 2. Body size check and JSON reading
  const { body, error: bodyError } = await readJsonBody(req, MAX_EXTRACT_BODY_SIZE);
  if (bodyError || body === null) {
    return sendError(res, bodyError?.status || 400, bodyError?.code || 'INVALID_REQUEST', bodyError?.message || 'Invalid body');
  }

  // 3. Rate limiting
  const clientIp = getClientIp(req);
  const rateResult = extractRateLimiter.check(clientIp);
  if (!rateResult.allowed) {
    return sendError(
      res,
      429,
      'RATE_LIMITED',
      'Rate limit exceeded. Please wait before extracting announcements again.',
      { 'Retry-After': String(rateResult.retryAfterSeconds) }
    );
  }

  // 4. Request validation
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(body);
  } catch {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request body must be valid JSON');
  }

  const parseResult = ExtractRequestSchema.safeParse(parsedPayload);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]?.message || 'Invalid request parameters';
    return sendError(res, 400, 'INVALID_REQUEST', issue);
  }

  const { text, referenceDate, timezone } = parseResult.data;

  // 5. Gemini call
  const gemini = getGeminiClient();
  const prompt = buildExtractionPrompt(text, referenceDate, timezone);

  let rawAiOutput: string;
  try {
    rawAiOutput = await gemini.generateStructuredJson({
      prompt,
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      responseSchema: EXTRACTION_RESPONSE_SCHEMA,
    });
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      return sendError(res, err.statusCode, err.code, err.message);
    }
    return sendError(res, 500, 'INTERNAL', 'An unexpected error occurred while extracting notice.');
  }

  // 6. Parse JSON from AI in try/catch
  let rawItems: unknown;
  try {
    rawItems = JSON.parse(rawAiOutput);
  } catch {
    return sendError(
      res,
      502,
      'AI_INVALID_RESPONSE',
      'The AI response could not be understood. You can edit the notice manually.'
    );
  }

  if (!Array.isArray(rawItems)) {
    return sendError(
      res,
      502,
      'AI_INVALID_RESPONSE',
      'The AI response could not be understood. You can edit the notice manually.'
    );
  }

  // Cap at 10 items
  const itemsToProcess = rawItems.slice(0, 10);
  const normalizedPaste = normalizeText(text);
  const totalCount = itemsToProcess.length;

  const validatedDrafts: DraftNotice[] = [];

  for (const rawItem of itemsToProcess) {
    const itemResult = GeminiExtractItemSchema.safeParse(rawItem);
    if (!itemResult.success) {
      // Invalid item schema from AI
      continue;
    }

    const item = itemResult.data;
    const warnings: string[] = [];
    let reviewRequired = false;

    // Title processing
    const cleanTitle = sanitizeString(item.title, 120) || 'Untitled Campus Notice';

    // Category processing
    let category: Category = 'Other';
    if (item.category && CATEGORIES.includes(item.category as Category)) {
      category = item.category as Category;
    } else {
      warnings.push('Unrecognized category defaulted to Other');
      reviewRequired = true;
    }

    // Description processing
    const description = sanitizeString(item.description, 1000);

    // Venue processing
    const venue = sanitizeString(item.venue, 200);

    // Event Date & Time processing
    let eventDate: string | null = null;
    let eventTime: string | null = null;

    if (item.eventDate) {
      const cleanEventDate = item.eventDate.trim();
      if (isValidCalendarDate(cleanEventDate)) {
        eventDate = cleanEventDate;
        const diffFromRef = calendarDaysDifference(referenceDate, eventDate);
        if (diffFromRef > 365 * 2) {
          warnings.push('Event date is more than 2 years in the future');
          reviewRequired = true;
        }
      } else {
        warnings.push('Event date was invalid and was reset to null');
        reviewRequired = true;
      }
    }

    if (item.eventTime) {
      const cleanEventTime = item.eventTime.trim();
      if (isValidTime(cleanEventTime)) {
        eventTime = cleanEventTime;
      } else {
        warnings.push('Event time was invalid and was reset to null');
        reviewRequired = true;
      }
    }

    // Deadline Date & Time processing
    let deadlineDate: string | null = null;
    let deadlineTime: string | null = null;

    if (item.deadlineDate) {
      const cleanDeadlineDate = item.deadlineDate.trim();
      if (isValidCalendarDate(cleanDeadlineDate)) {
        deadlineDate = cleanDeadlineDate;
        const diffPast = calendarDaysDifference(deadlineDate, referenceDate);
        if (diffPast > 365) {
          warnings.push('Deadline date is more than 1 year in the past');
          reviewRequired = true;
        }
      } else {
        warnings.push('Deadline date was invalid and was reset to null');
        reviewRequired = true;
      }
    }

    if (item.deadlineTime) {
      const cleanDeadlineTime = item.deadlineTime.trim();
      if (isValidTime(cleanDeadlineTime)) {
        deadlineTime = cleanDeadlineTime;
      } else {
        warnings.push('Deadline time was invalid and was reset to null');
        reviewRequired = true;
      }
    }

    // Date Ambiguity check
    if (item.dateAmbiguous) {
      warnings.push('Date or time was ambiguous in the original announcement');
      reviewRequired = true;
    }

    // Missing date/deadline check
    if (!eventDate && !deadlineDate) {
      warnings.push('No event date or deadline found');
      reviewRequired = true;
    }

    // Missing fields from AI
    if (Array.isArray(item.missingFields)) {
      for (const mf of item.missingFields) {
        if (typeof mf === 'string' && mf.trim()) {
          const cleanMf = mf.trim();
          if (!warnings.some((w) => w.toLowerCase().includes(cleanMf.toLowerCase()))) {
            warnings.push(`Missing field: ${cleanMf}`);
          }
        }
      }
    }

    // Source segment and contentHash calculation
    let contentHash = '';
    let validSegment: string | null = null;

    if (typeof item.sourceSegment === 'string' && item.sourceSegment.trim().length > 0) {
      const candidateSegment = item.sourceSegment.trim();
      const normSegment = normalizeText(candidateSegment);

      if (
        normSegment.length > 0 &&
        normSegment.length <= 8000 &&
        normalizedPaste.includes(normSegment)
      ) {
        validSegment = candidateSegment;
        contentHash = createHash('sha256').update(normSegment).digest('hex');
      } else {
        // Source segment was not found in pasted text
        warnings.push('Source segment could not be verified in original text');
      }
    }

    // Deterministic fallback hash if source segment invalid or missing
    if (!validSegment) {
      if (totalCount === 1) {
        contentHash = createHash('sha256').update(normalizedPaste).digest('hex');
      } else {
        const identityStr = [
          normalizeText(cleanTitle),
          eventDate || '',
          deadlineDate || '',
        ].join('|');
        contentHash = createHash('sha256').update(identityStr).digest('hex');
      }
    }

    if (warnings.length > 0) {
      reviewRequired = true;
    }

    validatedDrafts.push({
      id: randomUUID(),
      title: cleanTitle,
      description,
      category,
      eventDate,
      eventTime,
      venue,
      deadlineDate,
      deadlineTime,
      originalText: text,
      contentHash,
      reviewRequired,
      reviewWarnings: warnings,
      sourceSegment: validSegment,
    });
  }

  return sendJson(res, 200, { notices: validatedDrafts });
}
