import { describe, it, expect } from 'vitest';
import { classifyNotice } from '../shared/priority.js';
import { zonedTimeToUtc } from '../shared/dates.js';

describe('shared/priority.ts boundary tests', () => {
  const tzKolkata = 'Asia/Kolkata';
  const tzNewYork = 'America/New_York';

  it('handles unscheduled notice (no event date and no deadline)', () => {
    const fixedNow = new Date('2026-10-31T12:00:00Z');
    const result = classifyNotice(
      { eventDate: null, eventTime: null, deadlineDate: null, deadlineTime: null },
      fixedNow,
      tzKolkata
    );
    expect(result.status).toBe('Unscheduled');
    expect(result.nearestMomentMs).toBeNull();
    expect(result.countdownText).toBeNull();
  });

  it('handles expired notice when all relevant moments are in the past', () => {
    const fixedNow = new Date('2026-10-31T12:00:00Z');
    const result = classifyNotice(
      {
        eventDate: '2026-10-20',
        eventTime: '10:00',
        deadlineDate: '2026-10-25',
        deadlineTime: '23:59',
      },
      fixedNow,
      tzKolkata
    );
    expect(result.status).toBe('Expired');
    expect(result.countdownText).toContain('Overdue by');
  });

  it('handles notice with only a past event and a future deadline (must NOT be expired)', () => {
    // Current time: 2026-10-31 12:00 IST
    // Past event: 2026-10-25
    // Future deadline: 2026-11-05
    const nowMs = zonedTimeToUtc('2026-10-31', '12:00', tzKolkata, false);
    const result = classifyNotice(
      {
        eventDate: '2026-10-25',
        eventTime: '14:00',
        deadlineDate: '2026-11-05',
        deadlineTime: '17:00',
      },
      nowMs,
      tzKolkata
    );
    expect(result.status).toBe('Upcoming');
    expect(result.keyDate).toBe('2026-11-05');
  });

  it('handles date-only deadline today: Urgent until the end of today (23:59:59)', () => {
    // Today is 2026-10-31 in Asia/Kolkata
    const nowMs = zonedTimeToUtc('2026-10-31', '09:00', tzKolkata, false);
    const result = classifyNotice(
      {
        eventDate: null,
        eventTime: null,
        deadlineDate: '2026-10-31',
        deadlineTime: null,
      },
      nowMs,
      tzKolkata
    );
    expect(result.status).toBe('Urgent');
    expect(result.isDueToday).toBe(true);
    expect(result.countdownText).toBe('Due today');
  });

  it('handles exactly 48h boundary', () => {
    // Reference: 2026-10-31 10:00:00 local
    const nowMs = zonedTimeToUtc('2026-10-31', '10:00', tzKolkata, false);

    // Exactly 48 hours later: 2026-11-02 10:00:00 local
    const boundaryNotice = {
      eventDate: '2026-11-02',
      eventTime: '10:00',
      deadlineDate: null,
      deadlineTime: null,
    };
    const atBoundary = classifyNotice(boundaryNotice, nowMs, tzKolkata);
    expect(atBoundary.status).toBe('Urgent');

    // 48 hours and 1 minute later: 2026-11-02 10:01:00 local
    const beyondNotice = {
      eventDate: '2026-11-02',
      eventTime: '10:01',
      deadlineDate: null,
      deadlineTime: null,
    };
    const beyondBoundary = classifyNotice(beyondNotice, nowMs, tzKolkata);
    expect(beyondBoundary.status).toBe('Upcoming');
  });

  it('handles midnight boundary transition correctly', () => {
    // Current time: 2026-10-31 23:59:58 (2 seconds before midnight)
    const justBeforeMidnight = zonedTimeToUtc('2026-10-31', '23:59', tzKolkata, false) + 58 * 1000;
    const deadlineToday = {
      eventDate: null,
      eventTime: null,
      deadlineDate: '2026-10-31',
      deadlineTime: null, // date-only deadline expires at 23:59:59 local
    };
    const resActive = classifyNotice(deadlineToday, justBeforeMidnight, tzKolkata);
    expect(resActive.status).toBe('Urgent');

    // 2 seconds later (2026-11-01 00:00:00)
    const justAfterMidnight = justBeforeMidnight + 3000;
    const resExpired = classifyNotice(deadlineToday, justAfterMidnight, tzKolkata);
    expect(resExpired.status).toBe('Expired');
  });

  it('respects timezone differences between Asia/Kolkata and America/New_York', () => {
    // 2026-10-31 22:00:00 UTC
    // In Asia/Kolkata (+5:30): this is 2026-11-01 03:30:00 AM (the next month!)
    // In America/New_York (-4:00 EDT): this is 2026-10-31 18:00:00 PM (Halloween night!)
    const instantUtc = Date.UTC(2026, 9, 31, 22, 0, 0);

    const halloweenNotice = {
      eventDate: '2026-10-31',
      eventTime: '20:00',
      deadlineDate: null,
      deadlineTime: null,
    };

    const resNy = classifyNotice(halloweenNotice, instantUtc, tzNewYork);
    // In NY, 20:00 is in 2 hours -> Urgent
    expect(resNy.status).toBe('Urgent');

    const resKolkata = classifyNotice(halloweenNotice, instantUtc, tzKolkata);
    // In Kolkata, 2026-10-31 20:00 IST has already passed earlier in the day -> Expired
    expect(resKolkata.status).toBe('Expired');
  });

  it('handles leap day (2028-02-29)', () => {
    const leapNow = zonedTimeToUtc('2028-02-28', '12:00', tzKolkata, false);
    const leapNotice = {
      eventDate: '2028-02-29',
      eventTime: '15:00',
      deadlineDate: null,
      deadlineTime: null,
    };
    const res = classifyNotice(leapNotice, leapNow, tzKolkata);
    expect(res.status).toBe('Urgent');
    expect(res.keyDate).toBe('2028-02-29');
  });

  it('handles year-end rollover (2026-12-31 to 2027-01-01)', () => {
    const newYearsEve = zonedTimeToUtc('2026-12-31', '20:00', tzKolkata, false);
    const newYearsDayNotice = {
      eventDate: '2027-01-01',
      eventTime: '10:00',
      deadlineDate: null,
      deadlineTime: null,
    };
    const res = classifyNotice(newYearsDayNotice, newYearsEve, tzKolkata);
    expect(res.status).toBe('Urgent');
    expect(res.keyDate).toBe('2027-01-01');
  });
});
