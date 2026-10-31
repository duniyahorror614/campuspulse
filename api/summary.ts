import type { IncomingMessage, ServerResponse } from 'http';
import {
  MAX_SUMMARY_BODY_SIZE,
  readJsonBody,
  sendError,
  sendJson,
  getClientIp,
} from './_lib/http.js';
import { summaryRateLimiter } from './_lib/rateLimit.js';
import { getGeminiClient, GeminiServiceError } from './_lib/gemini.js';
import {
  buildSummaryPrompt,
  SUMMARY_RESPONSE_SCHEMA,
  SUMMARY_SYSTEM_INSTRUCTION,
} from './_lib/prompts.js';
import { selectNoticesForWeeklySummary } from './_lib/summaryContext.js';
import {
  SummaryRequestSchema,
  SummaryResponseSchema,
  SummaryItem,
  CompactNotice,
} from '../shared/schema.js';

function sanitizePlain(str: unknown, maxLen: number): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

function buildDeterministicSummary(
  selected: CompactNotice[],
  reason: 'empty' | 'fallback'
) {
  if (reason === 'empty' || selected.length === 0) {
    return {
      headline: 'Nothing scheduled for this week',
      items: [],
      actions: ['Enjoy your free time or check back later for new updates.'],
      generatedWithoutAi: true,
    };
  }

  const items: SummaryItem[] = selected.slice(0, 5).map((n) => {
    let dateInfo = '';
    if (n.deadlineDate) {
      dateInfo = `Deadline: ${n.deadlineDate}${n.deadlineTime ? ' at ' + n.deadlineTime : ''}`;
    } else if (n.eventDate) {
      dateInfo = `Event: ${n.eventDate}${n.eventTime ? ' at ' + n.eventTime : ''}`;
    }
    const text = `${n.title}${dateInfo ? ' (' + dateInfo + ')' : ''}`;
    return {
      noticeId: n.id,
      text: text.slice(0, 300),
      action: n.deadlineDate ? 'Review and complete' : 'Mark on calendar',
    };
  });

  const actions = [
    selected.some((n) => n.deadlineDate) ? 'Prioritize pending assignments/deadlines' : null,
    'Verify dates and venues for campus events',
  ].filter(Boolean) as string[];

  return {
    headline: `Campus digest: ${selected.length} notice${selected.length === 1 ? '' : 's'} requiring your attention this week`,
    items,
    actions: actions.slice(0, 3),
    generatedWithoutAi: true,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 1. Method check
  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST requests are allowed');
  }

  // 2. Body size check (100 KB) and JSON stream reading
  const { body, error: bodyError } = await readJsonBody(req, MAX_SUMMARY_BODY_SIZE);
  if (bodyError || body === null) {
    return sendError(res, bodyError?.status || 400, bodyError?.code || 'INVALID_REQUEST', bodyError?.message || 'Invalid body');
  }

  // 3. Rate limiting (5 req/min)
  const clientIp = getClientIp(req);
  const rateResult = summaryRateLimiter.check(clientIp);
  if (!rateResult.allowed) {
    return sendError(
      res,
      429,
      'RATE_LIMITED',
      'Rate limit exceeded for weekly summary. Please wait a minute before requesting again.',
      { 'Retry-After': String(rateResult.retryAfterSeconds) }
    );
  }

  // 4. JSON parse and Zod validation
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(body);
  } catch {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request body must be valid JSON');
  }

  const parseResult = SummaryRequestSchema.safeParse(parsedPayload);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]?.message || 'Invalid request payload';
    return sendError(res, 400, 'INVALID_REQUEST', issue);
  }

  const { referenceDate, timezone, notices } = parseResult.data;

  // 5. Deterministic selection of notices
  const selectedNotices = selectNoticesForWeeklySummary(notices, referenceDate, timezone);

  // If no notices are selected for this week, return deterministic response without calling Gemini
  if (selectedNotices.length === 0) {
    return sendJson(res, 200, buildDeterministicSummary([], 'empty'));
  }

  // 6. Gemini call
  const gemini = getGeminiClient();
  const validIds = new Set(selectedNotices.map((n) => n.id));

  const promptNotices = selectedNotices.map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description,
    category: n.category,
    eventDate: n.eventDate,
    eventTime: n.eventTime,
    venue: n.venue,
    deadlineDate: n.deadlineDate,
    deadlineTime: n.deadlineTime,
  }));

  const prompt = buildSummaryPrompt(
    JSON.stringify(promptNotices, null, 2),
    referenceDate,
    timezone
  );

  let rawAiOutput: string;
  try {
    rawAiOutput = await gemini.generateStructuredJson({
      prompt,
      systemInstruction: SUMMARY_SYSTEM_INSTRUCTION,
      responseSchema: SUMMARY_RESPONSE_SCHEMA,
    });
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      return sendError(res, err.statusCode, err.code, err.message);
    }
    return sendError(res, 500, 'INTERNAL', 'Failed to generate weekly summary');
  }

  // 7. Parse AI JSON
  let aiSummaryObj: Record<string, unknown>;
  try {
    aiSummaryObj = JSON.parse(rawAiOutput);
  } catch {
    return sendError(
      res,
      502,
      'AI_INVALID_RESPONSE',
      'The AI response could not be understood. You can view your notices directly.'
    );
  }

  const parseSummaryResult = SummaryResponseSchema.safeParse(aiSummaryObj);
  if (!parseSummaryResult.success) {
    // If schema parsing failed, use deterministic fallback
    return sendJson(res, 200, buildDeterministicSummary(selectedNotices, 'fallback'));
  }

  const aiData = parseSummaryResult.data;

  // Post-validate: filter out hallucinated notice IDs not in selected set
  const groundedItems = aiData.items
    .filter((item) => validIds.has(item.noticeId))
    .slice(0, 5)
    .map((item) => ({
      noticeId: item.noticeId,
      text: sanitizePlain(item.text, 300),
      action: item.action ? sanitizePlain(item.action, 150) : null,
    }));

  // If AI hallucinated all IDs and none survived, fallback deterministically
  if (groundedItems.length === 0) {
    return sendJson(res, 200, buildDeterministicSummary(selectedNotices, 'fallback'));
  }

  const cleanActions = aiData.actions
    .map((a) => sanitizePlain(a, 150))
    .filter((a) => a.length > 0)
    .slice(0, 3);

  const cleanHeadline = sanitizePlain(aiData.headline, 200) || 'Your Campus Weekly Overview';

  return sendJson(res, 200, {
    headline: cleanHeadline,
    items: groundedItems,
    actions: cleanActions,
    generatedWithoutAi: false,
  });
}
