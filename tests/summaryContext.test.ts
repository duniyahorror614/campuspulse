import { describe, it, expect } from 'vitest';
import type { CompactNotice } from '../shared/schema.js';
import { selectNoticesForWeeklySummary } from '../api/_lib/summaryContext.js';
import { generateDeterministicSummary } from '../src/lib/summaryFallback.js';

describe('Weekly Summary Context & Deterministic Fallback', () => {
  const refDate = '2026-10-31';
  const tz = 'Asia/Kolkata';

  const nInWindow: CompactNotice = {
    id: 'n-window',
    title: 'Midterm Exam',
    description: 'Covers chapters 1-4',
    category: 'Exam',
    eventDate: '2026-11-03', // 3 days away, inside [2026-10-31 .. 2026-11-07]
    eventTime: '10:00',
    venue: 'Hall 1',
    deadlineDate: null,
    deadlineTime: null,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
  };

  const nScheduleChange: CompactNotice = {
    id: 'n-change',
    title: 'Class Room Relocation',
    description: 'Moved to Lab 3',
    category: 'ScheduleChange',
    eventDate: '2026-11-20', // far future event date, but category is ScheduleChange
    eventTime: null,
    venue: 'Lab 3',
    deadlineDate: null,
    deadlineTime: null,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
  };

  const nFarFuture: CompactNotice = {
    id: 'n-far',
    title: 'Semester End Party',
    description: 'Celebration',
    category: 'Club',
    eventDate: '2026-12-25', // > 7 days away
    eventTime: null,
    venue: null,
    deadlineDate: null,
    deadlineTime: null,
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };

  const nExpired: CompactNotice = {
    id: 'n-past',
    title: 'Old Assignment 1',
    description: 'Past due',
    category: 'Assignment',
    eventDate: null,
    eventTime: null,
    venue: null,
    deadlineDate: '2026-10-15', // past
    deadlineTime: '23:59',
    createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };

  it('selects notices in weekly window or with schedule changes, excluding expired or far-future items', () => {
    const selected = selectNoticesForWeeklySummary(
      [nInWindow, nScheduleChange, nFarFuture, nExpired],
      refDate,
      tz
    );

    const ids = selected.map((n) => n.id);
    expect(ids).toContain('n-window');
    expect(ids).toContain('n-change');
    expect(ids).not.toContain('n-far');
    expect(ids).not.toContain('n-past');
  });

  it('returns empty array when no notices are relevant', () => {
    const selected = selectNoticesForWeeklySummary([nFarFuture, nExpired], refDate, tz);
    expect(selected.length).toBe(0);
  });

  it('generates grounded deterministic summary fallback with headline and at most 5 items', () => {
    const fallback = generateDeterministicSummary(
      [nInWindow as any, nScheduleChange as any],
      refDate,
      tz
    );

    expect(fallback.generatedWithoutAi).toBe(true);
    expect(fallback.headline).toContain('Weekly Digest');
    expect(fallback.items.length).toBe(2);
    expect(fallback.items[0].noticeId).toBeDefined();
    expect(fallback.actions.length).toBeGreaterThan(0);
    expect(fallback.actions.length).toBeLessThanOrEqual(3);
  });
});
