import React from 'react';
import type { Notice } from '../../shared/schema.js';
import type { PriorityInfo } from '../../shared/priority.js';
import { PriorityBadge } from './PriorityBadge.js';
import { Countdown } from './Countdown.js';

interface NoticeCardProps {
  notice: Notice;
  priority: PriorityInfo;
  onView: (notice: Notice) => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string, title: string) => void;
}

export const NoticeCard: React.FC<NoticeCardProps> = React.memo(
  ({ notice, priority, onView, onEdit, onDelete }) => {
    const isUrgent = priority.status === 'Urgent';

    return (
      <article
        className={`notice-card ${isUrgent ? 'urgent-card' : ''}`}
        aria-labelledby={`notice-title-${notice.id}`}
      >
        <div className="notice-card-header">
          <div className="card-title-group">
            <h3
              id={`notice-title-${notice.id}`}
              className="card-title"
              onClick={() => onView(notice)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onView(notice);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {notice.title}
            </h3>
          </div>
          <div className="card-badges">
            <span className="badge badge-category">{notice.category}</span>
            <PriorityBadge status={priority.status} />
          </div>
        </div>

        <div className="card-meta">
          {notice.eventDate && (
            <span className="card-meta-item">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>
                Event: {notice.eventDate}
                {notice.eventTime ? ` at ${notice.eventTime}` : ''}
              </span>
            </span>
          )}

          {notice.deadlineDate && (
            <span className="card-meta-item" style={{ color: isUrgent ? 'var(--status-urgent-badge)' : undefined }}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Deadline: {notice.deadlineDate}
                {notice.deadlineTime ? ` at ${notice.deadlineTime}` : ''}
              </span>
            </span>
          )}

          {notice.venue && (
            <span className="card-meta-item">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{notice.venue}</span>
            </span>
          )}
        </div>

        {notice.description && (
          <p className="card-description">{notice.description}</p>
        )}

        {notice.reviewWarnings && notice.reviewWarnings.length > 0 && (
          <div className="card-warnings-list" aria-label="Review warnings">
            {notice.reviewWarnings.map((warning, idx) => (
              <span key={idx} className="badge badge-warning">
                ⚠ {warning}
              </span>
            ))}
          </div>
        )}

        <div className="card-footer">
          <div>
            <Countdown text={priority.countdownText} isUrgent={isUrgent} />
          </div>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onEdit(notice)}
              aria-label={`Edit notice: ${notice.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDelete(notice.id, notice.title)}
              aria-label={`Delete notice: ${notice.title}`}
              style={{ color: '#dc2626' }}
            >
              Delete
            </button>
          </div>
        </div>
      </article>
    );
  }
);

NoticeCard.displayName = 'NoticeCard';
