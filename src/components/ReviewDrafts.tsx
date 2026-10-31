import React, { useState } from 'react';
import type { DraftNotice, Notice, Category } from '../../shared/schema.js';
import { CATEGORIES } from '../../shared/schema.js';
import { checkForDuplicate } from '../lib/duplicates.js';

interface ReviewDraftsProps {
  drafts: DraftNotice[];
  existingNotices: Notice[];
  onSaveNotice: (notice: Notice) => void;
  onSaveAll: (notices: Notice[]) => void;
  onDiscardDraft: (draftId: string) => void;
  onDiscardAll: () => void;
}

export const ReviewDrafts: React.FC<ReviewDraftsProps> = ({
  drafts,
  existingNotices,
  onSaveNotice,
  onSaveAll,
  onDiscardDraft,
  onDiscardAll,
}) => {
  // Local state for editable draft copies
  const [editableDrafts, setEditableDrafts] = useState<DraftNotice[]>(drafts);
  const [overrideDuplicateIds, setOverrideDuplicateIds] = useState<Set<string>>(new Set());

  const handleFieldChange = (
    draftId: string,
    field: keyof DraftNotice,
    value: unknown
  ) => {
    setEditableDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, [field]: value } : d))
    );
  };

  const toNotice = (draft: DraftNotice): Notice => {
    const nowIso = new Date().toISOString();
    return {
      id: draft.id,
      title: draft.title,
      description: draft.description,
      category: draft.category,
      eventDate: draft.eventDate,
      eventTime: draft.eventTime,
      venue: draft.venue,
      deadlineDate: draft.deadlineDate,
      deadlineTime: draft.deadlineTime,
      originalText: draft.originalText,
      contentHash: draft.contentHash,
      reviewRequired: false,
      reviewWarnings: draft.reviewWarnings,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  };

  const handleSaveSingle = (draft: DraftNotice) => {
    onSaveNotice(toNotice(draft));
  };

  const handleSaveAll = () => {
    const notices = editableDrafts.map(toNotice);
    onSaveAll(notices);
  };

  if (editableDrafts.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-xl)' }}>
            Review Extracted Draft{editableDrafts.length === 1 ? '' : 's'} ({editableDrafts.length})
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Review and adjust AI-extracted fields before saving. Nothing is saved until you click Save.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onDiscardAll}
          >
            Discard All
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveAll}
          >
            Save All Drafts
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {editableDrafts.map((draft) => {
          const dupResult = checkForDuplicate(draft, existingNotices);
          const isDup = dupResult.isDuplicate && !overrideDuplicateIds.has(draft.id);

          return (
            <article
              key={draft.id}
              className="notice-card"
              style={{ borderLeft: '4px solid var(--color-primary)' }}
            >
              {isDup && (
                <div
                  role="alert"
                  style={{
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: 'var(--font-size-sm)',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <strong>Duplicate Detected:</strong> This looks like a duplicate of existing notice{' '}
                    <em>&quot;{dupResult.existingTitle}&quot;</em> ({dupResult.type} match).
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onDiscardDraft(draft.id)}
                    >
                      Discard Draft
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const next = new Set(overrideDuplicateIds);
                        next.add(draft.id);
                        setOverrideDuplicateIds(next);
                      }}
                    >
                      Save Anyway
                    </button>
                  </div>
                </div>
              )}

              {draft.reviewWarnings && draft.reviewWarnings.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {draft.reviewWarnings.map((warning, wIdx) => (
                    <span key={wIdx} className="badge badge-warning">
                      ⚠ {warning}
                    </span>
                  ))}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label htmlFor={`draft-title-${draft.id}`} className="form-label">
                  Title
                </label>
                <input
                  id={`draft-title-${draft.id}`}
                  type="text"
                  className="form-input"
                  value={draft.title}
                  onChange={(e) => handleFieldChange(draft.id, 'title', e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="form-row" style={{ marginBottom: '8px' }}>
                <div className="form-group">
                  <label htmlFor={`draft-cat-${draft.id}`} className="form-label">
                    Category
                  </label>
                  <select
                    id={`draft-cat-${draft.id}`}
                    className="form-select"
                    value={draft.category}
                    onChange={(e) => handleFieldChange(draft.id, 'category', e.target.value as Category)}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor={`draft-venue-${draft.id}`} className="form-label">
                    Venue
                  </label>
                  <input
                    id={`draft-venue-${draft.id}`}
                    type="text"
                    className="form-input"
                    value={draft.venue || ''}
                    onChange={(e) => handleFieldChange(draft.id, 'venue', e.target.value || null)}
                    placeholder="e.g. Auditorium / Online"
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '8px' }}>
                <div className="form-group">
                  <label htmlFor={`draft-event-date-${draft.id}`} className="form-label">
                    Event Date
                  </label>
                  <input
                    id={`draft-event-date-${draft.id}`}
                    type="date"
                    className="form-input"
                    value={draft.eventDate || ''}
                    onChange={(e) => handleFieldChange(draft.id, 'eventDate', e.target.value || null)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`draft-event-time-${draft.id}`} className="form-label">
                    Event Time
                  </label>
                  <input
                    id={`draft-event-time-${draft.id}`}
                    type="time"
                    className="form-input"
                    value={draft.eventTime || ''}
                    onChange={(e) => handleFieldChange(draft.id, 'eventTime', e.target.value || null)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`draft-deadline-date-${draft.id}`} className="form-label">
                    Deadline Date
                  </label>
                  <input
                    id={`draft-deadline-date-${draft.id}`}
                    type="date"
                    className="form-input"
                    value={draft.deadlineDate || ''}
                    onChange={(e) => handleFieldChange(draft.id, 'deadlineDate', e.target.value || null)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`draft-deadline-time-${draft.id}`} className="form-label">
                    Deadline Time
                  </label>
                  <input
                    id={`draft-deadline-time-${draft.id}`}
                    type="time"
                    className="form-input"
                    value={draft.deadlineTime || ''}
                    onChange={(e) => handleFieldChange(draft.id, 'deadlineTime', e.target.value || null)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label htmlFor={`draft-desc-${draft.id}`} className="form-label">
                  Description
                </label>
                <textarea
                  id={`draft-desc-${draft.id}`}
                  className="form-textarea"
                  value={draft.description || ''}
                  onChange={(e) => handleFieldChange(draft.id, 'description', e.target.value || null)}
                  rows={2}
                  maxLength={1000}
                />
              </div>

              <details style={{ marginTop: '4px', fontSize: 'var(--font-size-xs)' }}>
                <summary style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
                  Original Announcement Text
                </summary>
                <div
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginTop: '6px',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                  }}
                >
                  {draft.originalText}
                </div>
              </details>

              <div className="card-footer" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#dc2626' }}
                  onClick={() => onDiscardDraft(draft.id)}
                >
                  Discard Draft
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSaveSingle(draft)}
                >
                  Save Notice
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
