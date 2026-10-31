import { describe, it, expect } from 'vitest';
import {
  isValidCalendarDate,
  isValidTime,
  isValidTimezone,
  NoticeSchema,
  ExtractRequestSchema,
  SummaryRequestSchema,
} from '../shared/schema.js';
import {
  addDaysToDateString,
  calendarDaysDifference,
  zonedTimeToUtc,
  getDateStringInTimezone,
} from '../shared/dates.js';

describe('shared/dates.ts and schema validation', () => {
  it('validates calendar dates strictly, rejecting impossible dates', () => {
    // Leap year checks
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('2028-02-29')).toBe(true);
    expect(isValidCalendarDate('2026-02-29')).toBe(false); // 2026 not a leap year
    expect(isValidCalendarDate('2026-02-30')).toBe(false);

    // 30-day months
    expect(isValidCalendarDate('2026-04-30')).toBe(true);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);

    // Out of range
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('not-a-date')).toBe(false);
  });

  it('validates 24-hour time HH:mm format', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('12:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);

    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('2:30')).toBe(false);
    expect(isValidTime('pm')).toBe(false);
  });

  it('validates IANA timezones', () => {
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);

    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  it('calculates calendar days difference and adds days safely', () => {
    expect(calendarDaysDifference('2026-10-31', '2026-11-05')).toBe(5);
    expect(calendarDaysDifference('2026-11-05', '2026-10-31')).toBe(-5);
    expect(calendarDaysDifference('2026-12-31', '2027-01-01')).toBe(1);

    expect(addDaysToDateString('2026-10-31', 2)).toBe('2026-11-02');
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateString('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('converts zoned time to UTC and formats back accurately', () => {
    const tz = 'Asia/Kolkata';
    const epochMs = zonedTimeToUtc('2026-10-31', '14:30', tz, false);
    const dateStr = getDateStringInTimezone(epochMs, tz);
    expect(dateStr).toBe('2026-10-31');
  });

  it('validates NoticeSchema against valid and invalid notices', () => {
    const validNotice = {
      id: 'abc-123',
      title: 'Valid Notice',
      description: 'A valid description',
      category: 'Exam',
      eventDate: '2026-11-15',
      eventTime: '09:00',
      venue: 'Hall A',
      deadlineDate: '2026-11-10',
      deadlineTime: '23:59',
      originalText: 'Raw announcement',
      contentHash: 'hash123',
      reviewRequired: false,
      reviewWarnings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(NoticeSchema.safeParse(validNotice).success).toBe(true);

    // Rejects impossible event date
    const withImpossibleDate = { ...validNotice, eventDate: '2026-02-30' };
    expect(NoticeSchema.safeParse(withImpossibleDate).success).toBe(false);

    // Rejects empty title
    const withEmptyTitle = { ...validNotice, title: '   ' };
    expect(NoticeSchema.safeParse(withEmptyTitle).success).toBe(false);

    // Rejects invalid category
    const withBadCategory = { ...validNotice, category: 'InvalidCategory' };
    expect(NoticeSchema.safeParse(withBadCategory).success).toBe(false);
  });

  it('validates ExtractRequestSchema constraints', () => {
    // Valid
    const validReq = {
      text: 'Professor announcement here',
      referenceDate: '2026-10-31',
      timezone: 'Asia/Kolkata',
    };
    expect(ExtractRequestSchema.safeParse(validReq).success).toBe(true);

    // Empty text
    expect(ExtractRequestSchema.safeParse({ ...validReq, text: '   ' }).success).toBe(false);

    // Text over 8000 characters
    expect(
      ExtractRequestSchema.safeParse({ ...validReq, text: 'x'.repeat(8001) }).success
    ).toBe(false);

    // Invalid timezone
    expect(
      ExtractRequestSchema.safeParse({ ...validReq, timezone: 'Fake/Zone' }).success
    ).toBe(false);
  });

  it('enforces maximum 60 notices in SummaryRequestSchema', () => {
    const validNotices = Array.from({ length: 60 }, (_, i) => ({
      id: `notice-${i}`,
      title: `Notice ${i}`,
      description: 'Description',
      category: 'Academic' as const,
      eventDate: '2026-11-01',
      eventTime: '10:00',
      venue: null,
      deadlineDate: null,
      deadlineTime: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const validReq = {
      referenceDate: '2026-10-31',
      timezone: 'Asia/Kolkata',
      notices: validNotices,
    };
    expect(SummaryRequestSchema.safeParse(validReq).success).toBe(true);

    // 61 notices exceeds max 60
    const overLimitReq = {
      ...validReq,
      notices: [...validNotices, { ...validNotices[0], id: 'notice-61' }],
    };
    expect(SummaryRequestSchema.safeParse(overLimitReq).success).toBe(false);
  });
});
