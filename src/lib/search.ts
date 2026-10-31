import type { Notice } from '../../shared/schema.js';

export interface SearchableNotice {
  notice: Notice;
  searchText: string;
}

/**
 * Precomputes a single lowercased searchable string per notice.
 * Run once when notices change, NOT on every keystroke.
 * Complexity: O(n) time, O(n) space.
 */
export function buildSearchIndex(notices: Notice[]): SearchableNotice[] {
  return notices.map((notice) => {
    const text = [
      notice.title,
      notice.description || '',
      notice.venue || '',
      notice.category,
      notice.eventDate || '',
      notice.deadlineDate || '',
    ]
      .join(' ')
      .toLowerCase();

    return {
      notice,
      searchText: text,
    };
  });
}

/**
 * Multi-term AND search over precomputed lowercase text.
 * A notice matches only if ALL search terms appear in its searchText.
 * Complexity: O(n * m) where n is notice count and m is search term count.
 */
export function searchNotices(
  indexed: SearchableNotice[],
  query: string
): Notice[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return indexed.map((item) => item.notice);
  }

  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return indexed.map((item) => item.notice);
  }

  const results: Notice[] = [];
  for (let i = 0; i < indexed.length; i++) {
    const item = indexed[i];
    let matchesAll = true;

    for (let j = 0; j < terms.length; j++) {
      if (!item.searchText.includes(terms[j])) {
        matchesAll = false;
        break;
      }
    }

    if (matchesAll) {
      results.push(item.notice);
    }
  }

  return results;
}
