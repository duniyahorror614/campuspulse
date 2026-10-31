import { zonedTimeToUtc, getDateStringInTimezone, formatCountdown } from './dates.js';

export type NoticeStatus = 'Urgent' | 'Upcoming' | 'Expired' | 'Unscheduled';

export interface PriorityInfo {
  status: NoticeStatus;
  nearestMomentMs: number | null;
  keyDate: string | null;
  countdownText: string | null;
  isDueToday: boolean;
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Pure priority classification function.
 * 
 * Rules:
 * - A notice's "relevant moments" are its event datetime and deadline datetime.
 * - A date without a time counts as END of that day (23:59:59 local) for expiry and countdown.
 * - Expired: all relevant moments are strictly in the past.
 * - Urgent: not expired AND the nearest future relevant moment is within 48 hours of now.
 *   A deadline with no time due today is Urgent until the end of today.
 * - Upcoming: not expired, nearest future moment more than 48 hours away.
 * - Unscheduled: no event date and no deadline.
 * - If both event and deadline exist, use the nearest FUTURE moment; if only one is past,
 *   the notice is not expired.
 */
export function classifyNotice(
  notice: {
    eventDate?: string | null;
    eventTime?: string | null;
    deadlineDate?: string | null;
    deadlineTime?: string | null;
  },
  now: Date | number,
  timezone: string
): PriorityInfo {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const todayStr = getDateStringInTimezone(nowMs, timezone);

  const moments: Array<{ type: 'event' | 'deadline'; date: string; time: string | null; ms: number }> = [];

  if (notice.eventDate) {
    const time = notice.eventTime || null;
    const ms = zonedTimeToUtc(notice.eventDate, time, timezone, true);
    moments.push({ type: 'event', date: notice.eventDate, time, ms });
  }

  if (notice.deadlineDate) {
    const time = notice.deadlineTime || null;
    const ms = zonedTimeToUtc(notice.deadlineDate, time, timezone, true);
    moments.push({ type: 'deadline', date: notice.deadlineDate, time, ms });
  }

  // 1. Unscheduled if neither event nor deadline
  if (moments.length === 0) {
    return {
      status: 'Unscheduled',
      nearestMomentMs: null,
      keyDate: null,
      countdownText: null,
      isDueToday: false,
    };
  }

  // Future moments (ms >= nowMs)
  const futureMoments = moments.filter((m) => m.ms >= nowMs);

  // 2. Expired if all relevant moments are strictly in the past
  if (futureMoments.length === 0) {
    // Nearest past moment is the latest one
    moments.sort((a, b) => b.ms - a.ms);
    const latestPast = moments[0];
    return {
      status: 'Expired',
      nearestMomentMs: latestPast.ms,
      keyDate: latestPast.date,
      countdownText: formatCountdown(latestPast.ms, nowMs, false),
      isDueToday: false,
    };
  }

  // 3. Not expired: select the nearest future moment
  futureMoments.sort((a, b) => a.ms - b.ms);
  const nearest = futureMoments[0];
  const diffMs = nearest.ms - nowMs;

  const isDueTodayDateOnly =
    notice.deadlineDate === todayStr && !notice.deadlineTime && nearest.type === 'deadline';

  const isUrgent = diffMs <= FORTY_EIGHT_HOURS_MS;
  const status: NoticeStatus = isUrgent ? 'Urgent' : 'Upcoming';

  const isDueToday =
    (notice.deadlineDate === todayStr && nearest.type === 'deadline') ||
    (notice.eventDate === todayStr && nearest.type === 'event');

  return {
    status,
    nearestMomentMs: nearest.ms,
    keyDate: nearest.date,
    countdownText: formatCountdown(nearest.ms, nowMs, isDueTodayDateOnly),
    isDueToday,
  };
}
