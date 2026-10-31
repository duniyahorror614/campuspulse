import type { CompactNotice } from '../../shared/schema.js';
import { addDaysToDateString, getDateStringInTimezone, zonedTimeToUtc } from '../../shared/dates.js';
import { classifyNotice } from '../../shared/priority.js';

/**
 * Deterministically filters a set of notices down to those relevant for the weekly summary:
 * 1. Events or deadlines within today..today+7 days
 * 2. Urgent items (classified as Urgent)
 * 3. Important changes (category === 'ScheduleChange' or updatedAt within the last 7 days)
 */
export function selectNoticesForWeeklySummary(
  notices: CompactNotice[],
  referenceDate: string,
  timezone: string
): CompactNotice[] {
  const endDateStr = addDaysToDateString(referenceDate, 7);
  const sevenDaysAgoStr = addDaysToDateString(referenceDate, -7);

  // Reference timestamp at start of reference day in timezone
  const refMs = zonedTimeToUtc(referenceDate, '00:00', timezone, false);

  const selectedMap = new Map<string, CompactNotice>();

  for (const notice of notices) {
    let include = false;

    // Condition 1: events/deadlines within today..today+7 days
    if (notice.eventDate && notice.eventDate >= referenceDate && notice.eventDate <= endDateStr) {
      include = true;
    }
    if (notice.deadlineDate && notice.deadlineDate >= referenceDate && notice.deadlineDate <= endDateStr) {
      include = true;
    }

    // Condition 2: Urgent items
    if (!include) {
      const priority = classifyNotice(notice, refMs, timezone);
      if (priority.status === 'Urgent') {
        include = true;
      }
    }

    // Condition 3: Schedule changes or recent updates within last 7 days
    if (!include) {
      if (notice.category === 'ScheduleChange') {
        include = true;
      } else if (notice.updatedAt) {
        try {
          const updatedDateStr = getDateStringInTimezone(new Date(notice.updatedAt), timezone);
          if (updatedDateStr >= sevenDaysAgoStr && updatedDateStr <= endDateStr) {
            include = true;
          }
        } catch {
          // Ignore parse errors on updatedAt
        }
      }
    }

    if (include) {
      selectedMap.set(notice.id, notice);
    }
  }

  return Array.from(selectedMap.values());
}
