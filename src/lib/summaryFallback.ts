import type { Notice, SummaryResponse, SummaryItem } from '../../shared/schema.js';
import { addDaysToDateString, zonedTimeToUtc, getDateStringInTimezone } from '../../shared/dates.js';
import { classifyNotice } from '../../shared/priority.js';

export function generateDeterministicSummary(
  notices: Notice[],
  referenceDate: string,
  timezone: string
): SummaryResponse {
  const endDateStr = addDaysToDateString(referenceDate, 7);
  const sevenDaysAgoStr = addDaysToDateString(referenceDate, -7);
  const refMs = zonedTimeToUtc(referenceDate, '00:00', timezone, false);

  const selected: Notice[] = [];
  const seen = new Set<string>();

  for (const n of notices) {
    let include = false;

    if (n.eventDate && n.eventDate >= referenceDate && n.eventDate <= endDateStr) {
      include = true;
    }
    if (n.deadlineDate && n.deadlineDate >= referenceDate && n.deadlineDate <= endDateStr) {
      include = true;
    }

    if (!include) {
      const p = classifyNotice(n, refMs, timezone);
      if (p.status === 'Urgent') {
        include = true;
      }
    }

    if (!include) {
      if (n.category === 'ScheduleChange') {
        include = true;
      } else if (n.updatedAt) {
        try {
          const updatedDateStr = getDateStringInTimezone(new Date(n.updatedAt), timezone);
          if (updatedDateStr >= sevenDaysAgoStr && updatedDateStr <= endDateStr) {
            include = true;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    if (include && !seen.has(n.id)) {
      seen.add(n.id);
      selected.push(n);
    }
  }

  if (selected.length === 0) {
    return {
      headline: 'Nothing scheduled for this week',
      items: [],
      actions: ['Your campus schedule is clear for the week. Enjoy the downtime!'],
      generatedWithoutAi: true,
    };
  }

  // Sort by priority/urgency
  selected.sort((a, b) => {
    const pa = classifyNotice(a, refMs, timezone);
    const pb = classifyNotice(b, refMs, timezone);
    const order: Record<string, number> = { Urgent: 0, Upcoming: 1, Expired: 2, Unscheduled: 3 };
    const diff = (order[pa.status] ?? 3) - (order[pb.status] ?? 3);
    if (diff !== 0) return diff;
    return (pa.nearestMomentMs || 0) - (pb.nearestMomentMs || 0);
  });

  const items: SummaryItem[] = selected.slice(0, 5).map((n) => {
    let dateStr = '';
    if (n.deadlineDate) {
      dateStr = `Deadline: ${n.deadlineDate}${n.deadlineTime ? ' at ' + n.deadlineTime : ''}`;
    } else if (n.eventDate) {
      dateStr = `Event: ${n.eventDate}${n.eventTime ? ' at ' + n.eventTime : ''}`;
    }

    return {
      noticeId: n.id,
      text: `${n.title} — ${n.category}${dateStr ? ' (' + dateStr + ')' : ''}`,
      action: n.deadlineDate ? 'Submit before deadline' : 'Attend session',
    };
  });

  const actions: string[] = [];
  if (selected.some((n) => n.deadlineDate)) {
    actions.push('Review upcoming deadlines and submit assignments early');
  }
  if (selected.some((n) => n.eventDate)) {
    actions.push('Confirm event locations and times on your calendar');
  }
  if (actions.length === 0) {
    actions.push('Keep track of newly announced notices');
  }

  return {
    headline: `Weekly Digest: ${selected.length} notice${selected.length === 1 ? '' : 's'} scheduled this week`,
    items,
    actions: actions.slice(0, 3),
    generatedWithoutAi: true,
  };
}
