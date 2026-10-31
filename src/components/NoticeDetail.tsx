import React, { useEffect } from 'react';
import type { Notice } from '../../shared/schema.js';
import type { PriorityInfo } from '../../shared/priority.js';
import { PriorityBadge } from './PriorityBadge.js';
import { Countdown } from './Countdown.js';

interface NoticeDetailProps {
  notice: Notice | null;
  priority: PriorityInfo | null;
  onClose: () => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string, title: string) => void;
}

export const NoticeDetail: React.FC<NoticeDetailProps> = ({
  notice,
  priority,
  onClose,
  onEdit,
  onDelete,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!notice) return null;

  const isUrgent = priority?.status === 'Urgent';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <div className="modal-card">
        <div className="modal-header">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-category">{notice.category}</span>
            {priority && <PriorityBadge status={priority.status} />}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div>
          <h2 id="detail-title" style={{ fontSize: 'var(--font-size-xl)', marginBottom: '8px' }}>
            {notice.title}
          </h2>
          {priority?.countdownText && (
            <Countdown text={priority.countdownText} isUrgent={isUrgent} />
          )}
        </div>

        <div className="card-meta" style={{ flexDirection: 'column', gap: '8px' }}>
          {notice.eventDate && (
            <div>
              <strong>Event:</strong> {notice.eventDate}
              {notice.eventTime ? ` at ${notice.eventTime}` : ''}
            </div>
          )}
          {notice.deadlineDate && (
            <div style={{ color: isUrgent ? 'var(--status-urgent-badge)' : undefined }}>
              <strong>Deadline:</strong> {notice.deadlineDate}
              {notice.deadlineTime ? ` at ${notice.deadlineTime}` : ''}
            </div>
          )}
          {notice.venue && (
            <div>
              <strong>Venue:</strong> {notice.venue}
            </div>
          )}
          <div>
            <strong>Created:</strong> {new Date(notice.createdAt).toLocaleString()}
          </div>
          <div>
            <strong>Last Updated:</strong> {new Date(notice.updatedAt).toLocaleString()}
          </div>
        </div>

        {notice.description && (
          <div>
            <h4 style={{ fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>Description</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-wrap' }}>
              {notice.description}
            </p>
          </div>
        )}

        {notice.reviewWarnings && notice.reviewWarnings.length > 0 && (
          <div style={{ backgroundColor: '#fffbeb', padding: '12px', borderRadius: '6px' }}>
            <h4 style={{ fontSize: 'var(--font-size-xs)', color: '#b45309', marginBottom: '4px', textTransform: 'uppercase' }}>
              Review Warnings
            </h4>
            <ul style={{ paddingLeft: '16px', fontSize: 'var(--font-size-xs)', color: '#92400e' }}>
              {notice.reviewWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {notice.originalText && (
          <details style={{ marginTop: '8px' }}>
            <summary style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}>
              View Original Pasted Text
            </summary>
            <div
              style={{
                backgroundColor: 'var(--color-bg)',
                padding: '12px',
                borderRadius: '6px',
                marginTop: '8px',
                fontSize: 'var(--font-size-xs)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {notice.originalText}
            </div>
          </details>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#dc2626' }}
            onClick={() => onDelete(notice.id, notice.title)}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onEdit(notice);
            }}
          >
            Edit Notice
          </button>
        </div>
      </div>
    </div>
  );
};
