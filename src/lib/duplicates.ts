import type { Notice, DraftNotice } from '../../shared/schema.js';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  type: 'exact' | 'fuzzy' | null;
  existingTitle: string | null;
  existingId: string | null;
}

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return new Set(words);
}

export function computeJaccardSimilarity(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 && setB.size === 0) {
    return textA.trim().toLowerCase() === textB.trim().toLowerCase() ? 1.0 : 0.0;
  }

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0.0;
  return intersectionSize / unionSize;
}

/**
 * Checks whether a candidate notice is a duplicate of any existing notice:
 * (a) exact contentHash match
 * (b) fuzzy match: title token Jaccard >= 0.8 AND same eventDate or deadlineDate
 */
export function checkForDuplicate(
  candidate: Pick<Notice | DraftNotice, 'contentHash' | 'title' | 'eventDate' | 'deadlineDate'>,
  existingNotices: Notice[]
): DuplicateCheckResult {
  // 1. Exact hash check: O(n) or O(1) if hash set is queried
  if (candidate.contentHash) {
    for (const existing of existingNotices) {
      if (existing.contentHash === candidate.contentHash) {
        return {
          isDuplicate: true,
          type: 'exact',
          existingTitle: existing.title,
          existingId: existing.id,
        };
      }
    }
  }

  // 2. Fuzzy match
  for (const existing of existingNotices) {
    // Check if dates match (either both have same eventDate or both have same deadlineDate)
    const hasSameEventDate =
      Boolean(candidate.eventDate) && candidate.eventDate === existing.eventDate;
    const hasSameDeadlineDate =
      Boolean(candidate.deadlineDate) && candidate.deadlineDate === existing.deadlineDate;

    if (hasSameEventDate || hasSameDeadlineDate) {
      const similarity = computeJaccardSimilarity(candidate.title, existing.title);
      if (similarity >= 0.8) {
        return {
          isDuplicate: true,
          type: 'fuzzy',
          existingTitle: existing.title,
          existingId: existing.id,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    type: null,
    existingTitle: null,
    existingId: null,
  };
}
