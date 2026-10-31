import React, { useState, useEffect } from 'react';
import type { Notice, SummaryResponse, CompactNotice } from '../../shared/schema.js';
import { requestWeeklySummary } from '../lib/apiClient.js';
import { generateDeterministicSummary } from '../lib/summaryFallback.js';
import { EmptyState } from './EmptyState.js';

interface WeeklySummaryProps {
  notices: Notice[];
  referenceDate: string;
  timezone: string;
  isAiAvailable: boolean;
  onViewNoticeById: (noticeId: string) => void;
  onNavigateToAdd: () => void;
}

export const WeeklySummary: React.FC<WeeklySummaryProps> = ({
  notices,
  referenceDate,
  timezone,
  isAiAvailable,
  onViewNoticeById,
  onNavigateToAdd,
}) => {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cachedKey, setCachedKey] = useState<string>('');

  // Deterministically select up to 60 notices for the client request
  const compactNotices: CompactNotice[] = notices.slice(0, 60).map((n) => ({
    id: n.id,
    title: n.title,
    description: n.description ? n.description.slice(0, 300) : null,
    category: n.category,
    eventDate: n.eventDate,
    eventTime: n.eventTime,
    venue: n.venue,
    deadlineDate: n.deadlineDate,
    deadlineTime: n.deadlineTime,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));

  // Build cache key based on referenceDate + notice IDs + updatedAt
  const currentCacheKey = `${referenceDate}|${timezone}|${compactNotices
    .map((n) => `${n.id}:${n.updatedAt}`)
    .sort()
    .join(';')}`;

  const generateSummary = async (forceRegenerate = false) => {
    if (notices.length === 0) return;

    if (!forceRegenerate && summary && cachedKey === currentCacheKey) {
      return; // Use cached summary
    }

    setLoading(true);
    setErrorMsg(null);

    // If AI is not available, immediately use deterministic fallback
    if (!isAiAvailable) {
      const fallback = generateDeterministicSummary(notices, referenceDate, timezone);
      setSummary(fallback);
      setCachedKey(currentCacheKey);
      setLoading(false);
      return;
    }

    const res = await requestWeeklySummary(referenceDate, timezone, compactNotices);

    if (res.success && res.data) {
      setSummary(res.data);
      setCachedKey(currentCacheKey);
    } else {
      // API call failed: fallback to deterministic local summary
      const fallback = generateDeterministicSummary(notices, referenceDate, timezone);
      setSummary({
        ...fallback,
        generatedWithoutAi: true,
      });
      setCachedKey(currentCacheKey);
      setErrorMsg(
        'Generated without AI because the AI service was unavailable.'
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    if (notices.length > 0 && !summary) {
      generateSummary(false);
    }
  }, [notices.length]);

  if (notices.length === 0) {
    return (
      <EmptyState
        title="No notices available for summary"
        description="Add campus announcements first to see an intelligent weekly digest."
        actionText="Add Announcement"
        onAction={onNavigateToAdd}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Weekly Campus Digest</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            High-priority deadlines, scheduled events, and changes for the upcoming 7 days.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => generateSummary(true)}
          disabled={loading}
          aria-busy={loading}
        >
          {loading && <span className="spinner" aria-hidden="true" />}
          {loading ? 'Analyzing...' : 'Regenerate Digest'}
        </button>
      </div>

      {errorMsg && (
        <div
          role="status"
          style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: 'var(--font-size-sm)',
            color: '#1e40af',
          }}
        >
          {errorMsg}
        </div>
      )}

      {summary && (
        <div className="weekly-summary-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="summary-headline">{summary.headline}</h3>
            {summary.generatedWithoutAi ? (
              <span className="badge badge-unscheduled">
                ⚡ Deterministic digest (AI offline)
              </span>
            ) : (
              <span className="badge badge-upcoming">
                ✨ AI Synthesized & Grounded
              </span>
            )}
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-subtle)', marginBottom: '12px' }}>
              Key Updates This Week
            </h4>
            {summary.items.length === 0 ? (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                No events or deadlines scheduled for this week.
              </p>
            ) : (
              <ul className="summary-items-list">
                {summary.items.map((item, index) => (
                  <li key={index} className="summary-item">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="summary-item-text">{item.text}</span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--color-primary)',
                          fontSize: 'var(--font-size-xs)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: 500,
                          textDecoration: 'underline',
                        }}
                        onClick={() => onViewNoticeById(item.noticeId)}
                      >
                        View notice details →
                      </button>
                    </div>
                    {item.action && (
                      <span className="summary-item-action">
                        {item.action}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {summary.actions && summary.actions.length > 0 && (
            <div className="summary-actions-box">
              <h4>Recommended Next Steps</h4>
              <ol className="summary-actions-list">
                {summary.actions.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
