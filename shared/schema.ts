import { z } from 'zod';

export const CATEGORIES = [
  'Academic',
  'Exam',
  'Assignment',
  'Event',
  'Club',
  'Placement',
  'Administrative',
  'ScheduleChange',
  'Other',
] as const;

export const CategoryEnum = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategoryEnum>;

/**
 * Validates that YYYY-MM-DD corresponds to an actual calendar date (e.g., rejects 2026-02-30).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  
  // Test via Date constructor in UTC
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Validates HH:mm in 24-hour format (00:00 to 23:59).
 */
export function isValidTime(timeStr: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr);
}

/**
 * Validates timezone string using Intl.DateTimeFormat
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format')
  .refine(isValidCalendarDate, { message: 'Must be a real calendar date' });

export const TimeStringSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be in HH:mm 24-hour format');

export const NoticeSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(1000).nullable(),
  category: CategoryEnum,
  eventDate: DateStringSchema.nullable(),
  eventTime: TimeStringSchema.nullable(),
  venue: z.string().max(200).nullable(),
  deadlineDate: DateStringSchema.nullable(),
  deadlineTime: TimeStringSchema.nullable(),
  originalText: z.string().max(8000),
  contentHash: z.string().min(1),
  reviewRequired: z.boolean(),
  reviewWarnings: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Notice = z.infer<typeof NoticeSchema>;

export const DraftNoticeSchema = NoticeSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  sourceSegment: z.string().nullable().optional(),
});

export type DraftNotice = z.infer<typeof DraftNoticeSchema>;

export const ExtractRequestSchema = z.object({
  text: z.string().trim().min(1, 'Text cannot be empty').max(8000, 'Text exceeds 8000 characters'),
  referenceDate: DateStringSchema,
  timezone: z.string().refine(isValidTimezone, { message: 'Invalid IANA timezone string' }),
});

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const ExtractResponseSchema = z.object({
  notices: z.array(DraftNoticeSchema),
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

export const CompactNoticeSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  description: z.string().max(300).nullable().optional(),
  category: CategoryEnum,
  eventDate: DateStringSchema.nullable().optional(),
  eventTime: TimeStringSchema.nullable().optional(),
  venue: z.string().nullable().optional(),
  deadlineDate: DateStringSchema.nullable().optional(),
  deadlineTime: TimeStringSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CompactNotice = z.infer<typeof CompactNoticeSchema>;

export const SummaryRequestSchema = z.object({
  referenceDate: DateStringSchema,
  timezone: z.string().refine(isValidTimezone, { message: 'Invalid IANA timezone string' }),
  notices: z.array(CompactNoticeSchema).max(60, 'Maximum 60 notices allowed'),
});

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

export const SummaryItemSchema = z.object({
  noticeId: z.string(),
  text: z.string().max(300),
  action: z.string().max(150).nullable(),
});

export type SummaryItem = z.infer<typeof SummaryItemSchema>;

export const SummaryResponseSchema = z.object({
  headline: z.string().max(200),
  items: z.array(SummaryItemSchema).max(5),
  actions: z.array(z.string().max(150)).max(3),
  generatedWithoutAi: z.boolean().optional(),
});

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  aiAvailable: z.boolean(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// Raw Gemini Extraction Item Schema (before server post-processing)
export const GeminiExtractItemSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  eventDate: z.string().nullable().optional(),
  eventTime: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  deadlineDate: z.string().nullable().optional(),
  deadlineTime: z.string().nullable().optional(),
  dateAmbiguous: z.boolean().optional(),
  missingFields: z.array(z.string()).optional(),
  sourceSegment: z.string().nullable().optional(),
});

export type GeminiExtractItem = z.infer<typeof GeminiExtractItemSchema>;
