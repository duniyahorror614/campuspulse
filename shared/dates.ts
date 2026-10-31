/**
 * Pure date utilities with safe timezone support using standard Intl.DateTimeFormat.
 * Avoids new Date("YYYY-MM-DD") which parses as UTC.
 */

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extracts calendar date/time parts for an instant in a given IANA timezone.
 */
export function getPartsInTimezone(instant: Date | number, timezone: string): ZonedDateParts {
  const date = typeof instant === 'number' ? new Date(instant) : instant;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
    else if (part.type === 'hour') {
      const h = Number(part.value);
      hour = h === 24 ? 0 : h; // en-US 24h can produce 24 for midnight in some implementations
    } else if (part.type === 'minute') minute = Number(part.value);
    else if (part.type === 'second') second = Number(part.value);
  }

  return { year, month, day, hour, minute, second };
}

/**
 * Returns "YYYY-MM-DD" for the instant in the given timezone.
 */
export function getDateStringInTimezone(instant: Date | number, timezone: string): string {
  const parts = getPartsInTimezone(instant, timezone);
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${parts.year}-${m}-${d}`;
}

/**
 * Converts a calendar date string (YYYY-MM-DD) and optional time (HH:mm) in a specific
 * timezone into UTC epoch milliseconds.
 * If timeStr is omitted and isEndOfDayIfNoTime is true, sets time to 23:59:59.
 */
export function zonedTimeToUtc(
  dateStr: string,
  timeStr: string | null,
  timezone: string,
  isEndOfDayIfNoTime = true
): number {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const targetYear = Number(yStr);
  const targetMonth = Number(mStr);
  const targetDay = Number(dStr);

  let targetHour = 0;
  let targetMinute = 0;
  let targetSecond = 0;

  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    const [hStr, minStr] = timeStr.split(':');
    targetHour = Number(hStr);
    targetMinute = Number(minStr);
    targetSecond = 0;
  } else if (isEndOfDayIfNoTime) {
    targetHour = 23;
    targetMinute = 59;
    targetSecond = 59;
  }

  // Iterative convergence to find the exact UTC timestamp matching target parts in timezone
  let guess = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute, targetSecond);

  for (let i = 0; i < 3; i++) {
    const observed = getPartsInTimezone(guess, timezone);
    const observedMs = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const targetMs = Date.UTC(
      targetYear,
      targetMonth - 1,
      targetDay,
      targetHour,
      targetMinute,
      targetSecond
    );

    const diff = targetMs - observedMs;
    if (diff === 0) break;
    guess += diff;
  }

  return guess;
}

/**
 * Adds integer days to a YYYY-MM-DD string using UTC calendar arithmetic.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns difference in calendar days between two YYYY-MM-DD strings (dateStr2 - dateStr1).
 */
export function calendarDaysDifference(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Formats a human-readable countdown string.
 * @param targetMs UTC timestamp of the relevant moment
 * @param nowMs UTC timestamp of current time
 * @param isDueTodayDateOnly whether this is a deadline with no specific time on today's calendar date
 */
export function formatCountdown(
  targetMs: number,
  nowMs: number,
  isDueTodayDateOnly = false
): string {
  if (isDueTodayDateOnly && targetMs >= nowMs) {
    return 'Due today';
  }

  const diffMs = targetMs - nowMs;

  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
    const overdueDays = Math.floor(overdueHours / 24);

    if (overdueDays >= 1) {
      return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
    }
    if (overdueHours >= 1) {
      return `Overdue by ${overdueHours} hour${overdueHours === 1 ? '' : 's'}`;
    }
    const overdueMins = Math.max(1, Math.floor(overdueMs / (1000 * 60)));
    return `Overdue by ${overdueMins} min${overdueMins === 1 ? '' : 's'}`;
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  const remainingMinutes = totalMinutes % 60;

  if (days >= 2) {
    return `${days} days ${remainingHours} hour${remainingHours === 1 ? '' : 's'} left`;
  }
  if (days === 1) {
    return `1 day ${remainingHours} hour${remainingHours === 1 ? '' : 's'} left`;
  }
  if (totalHours >= 1) {
    return `${totalHours} hour${totalHours === 1 ? '' : 's'} ${remainingMinutes} min${remainingMinutes === 1 ? '' : 's'} left`;
  }
  return `${Math.max(1, remainingMinutes)} min${remainingMinutes === 1 ? '' : 's'} left`;
}
