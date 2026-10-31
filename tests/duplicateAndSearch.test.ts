import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Notice } from '../shared/schema.js';
import { checkForDuplicate, computeJaccardSimilarity } from '../src/lib/duplicates.js';
import { buildSearchIndex, searchNotices } from '../src/lib/search.js';
import { NoticeStorage, STORAGE_KEY } from '../src/lib/storage.js';

describe('Duplicates, Search, and Storage resilience', () => {
  const sampleNotice1: Notice = {
    id: 'n-1',
    title: 'CS302 Database Project Submission',
    description: 'Submit your GitHub repo and PDF report by midnight.',
    category: 'Assignment',
    eventDate: null,
    eventTime: null,
    venue: null,
    deadlineDate: '2026-11-05',
    deadlineTime: '23:59',
    originalText: 'Pasted notice text 1',
    contentHash: 'hash-abc-123',
    reviewRequired: false,
    reviewWarnings: [],
    createdAt: '2026-10-31T10:00:00.000Z',
    updatedAt: '2026-10-31T10:00:00.000Z',
  };

  const sampleNotice2: Notice = {
    id: 'n-2',
    title: 'Campus Hackathon 2026 Registration',
    description: 'Annual hackathon in main auditorium.',
    category: 'Event',
    eventDate: '2026-11-12',
    eventTime: '09:00',
    venue: 'Main Auditorium',
    deadlineDate: '2026-11-08',
    deadlineTime: '18:00',
    originalText: 'Pasted notice text 2',
    contentHash: 'hash-def-456',
    reviewRequired: false,
    reviewWarnings: [],
    createdAt: '2026-10-31T10:05:00.000Z',
    updatedAt: '2026-10-31T10:05:00.000Z',
  };

  it('detects exact duplicate by contentHash match', () => {
    const candidate = {
      contentHash: 'hash-abc-123',
      title: 'Different title but identical text hash',
      eventDate: null,
      deadlineDate: null,
    };

    const res = checkForDuplicate(candidate, [sampleNotice1, sampleNotice2]);
    expect(res.isDuplicate).toBe(true);
    expect(res.type).toBe('exact');
    expect(res.existingId).toBe('n-1');
  });

  it('detects fuzzy duplicate when title Jaccard >= 0.8 and deadlineDate matches', () => {
    const candidate = {
      contentHash: 'new-different-hash',
      title: 'CS302 Database Project Submission Deadline', // High token overlap
      eventDate: null,
      deadlineDate: '2026-11-05', // Same deadline
    };

    const sim = computeJaccardSimilarity(candidate.title, sampleNotice1.title);
    expect(sim).toBeGreaterThanOrEqual(0.8);

    const res = checkForDuplicate(candidate, [sampleNotice1, sampleNotice2]);
    expect(res.isDuplicate).toBe(true);
    expect(res.type).toBe('fuzzy');
    expect(res.existingTitle).toBe('CS302 Database Project Submission');
  });

  it('does NOT flag as duplicate if title is similar but dates differ', () => {
    const candidate = {
      contentHash: 'another-hash',
      title: 'CS302 Database Project Submission',
      eventDate: null,
      deadlineDate: '2026-12-25', // completely different date
    };

    const res = checkForDuplicate(candidate, [sampleNotice1, sampleNotice2]);
    expect(res.isDuplicate).toBe(false);
  });

  it('does NOT flag as duplicate if titles are dissimilar', () => {
    const candidate = {
      contentHash: 'unique-hash',
      title: 'Robotics Club Orientation Meeting',
      eventDate: '2026-11-12',
      deadlineDate: null,
    };

    const res = checkForDuplicate(candidate, [sampleNotice1, sampleNotice2]);
    expect(res.isDuplicate).toBe(false);
  });

  it('searches notices with multi-term AND matching', () => {
    const index = buildSearchIndex([sampleNotice1, sampleNotice2]);

    // Matching single term
    const r1 = searchNotices(index, 'database');
    expect(r1.length).toBe(1);
    expect(r1[0].id).toBe('n-1');

    // Matching venue
    const r2 = searchNotices(index, 'auditorium');
    expect(r2.length).toBe(1);
    expect(r2[0].id).toBe('n-2');

    // Multi-term AND matching across title and description
    const r3 = searchNotices(index, 'cs302 github');
    expect(r3.length).toBe(1);
    expect(r3[0].id).toBe('n-1');

    // Non-matching multi-term
    const r4 = searchNotices(index, 'cs302 auditorium');
    expect(r4.length).toBe(0);

    // Empty query returns all
    const r5 = searchNotices(index, '   ');
    expect(r5.length).toBe(2);
  });

  describe('NoticeStorage resilience', () => {
    beforeEach(() => {
      window.localStorage.clear();
    });

    it('loads corrupted JSON gracefully and drops invalid items without crashing', () => {
      const corruptPayload = JSON.stringify([
        sampleNotice1,
        { id: 'corrupt-1', title: '' }, // invalid: missing fields
        { bad: 'data' }, // invalid
        sampleNotice2,
      ]);

      window.localStorage.setItem(STORAGE_KEY, corruptPayload);

      const storage = new NoticeStorage();
      const res = storage.loadFromLocalStorage();

      expect(res.notices.length).toBe(2);
      expect(res.skippedCount).toBe(2);
      expect(storage.getById('n-1')).toBeDefined();
      expect(storage.getById('n-2')).toBeDefined();
    });

    it('handles localStorage quota exceeded failure gracefully with in-memory persistence', () => {
      const quotaCallback = vi.fn();
      const storage = new NoticeStorage(quotaCallback);

      // Mock setItem throwing quota error
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      storage.save(sampleNotice1);
      const flushResult = storage.flushToLocalStorage();

      expect(flushResult).toBe(false);
      expect(quotaCallback).toHaveBeenCalled();
      // Data remains in memory
      expect(storage.getById('n-1')).toBeDefined();
      expect(storage.getAll().length).toBe(1);
    });
  });
});
