import React from 'react';
import type { Notice } from '../../shared/schema.js';
import type { PriorityInfo } from '../../shared/priority.js';
import { NoticeCard } from './NoticeCard.js';
import { EmptyState } from './EmptyState.js';

interface TodayPulseProps {
  notices: Notice[];
  priorities: Map<string, PriorityInfo>;
  onView: (notice: Notice) => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string, title: string) => void;
  onNavigateToAll: () => void;
  onNavigateToAdd: () => void;
  onNavigateToSummary: () => void;
}

export const TodayPulse: React.FC<TodayPulseProps> = ({
  notices,
  priorities,
  onView,
  onEdit,
  onDelete,
  onNavigateToAll,
  onNavigateToAdd,
  onNavigateToSummary,
}) => {
  let urgentCount = 0;
  let upcomingCount = 0;
  let expiredCount = 0;

  const todayNotices: Notice[] = [];
  const upcomingDeadlines: Notice[] = [];

  for (const notice of notices) {
    const p = priorities.get(notice.id);
    if (!p) continue;

    if (p.status === 'Urgent') urgentCount++;
    else if (p.status === 'Upcoming') upcomingCount++;
    else if (p.status === 'Expired') expiredCount++;

    if (p.isDueToday || p.status === 'Urgent') {
      todayNotices.push(notice);
    }

    if (notice.deadlineDate && (p.status === 'Upcoming' || p.status === 'Urgent')) {
      upcomingDeadlines.push(notice);
    }
  }

  // Sort upcoming deadlines by date ascending
  upcomingDeadlines.sort((a, b) => {
    const pa = priorities.get(a.id)?.nearestMomentMs || 0;
    const pb = priorities.get(b.id)?.nearestMomentMs || 0;
    return pa - pb;
  });

  const next5Deadlines = upcomingDeadlines.slice(0, 5);

  return (
    <div className="today-pulse-container">
      {/* 3 Overview Stat Cards */}
      <div className="pulse-summary-grid">
        <div className="summary-stat-card">
          <div className="stat-icon-wrapper stat-icon-urgent">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 22 20 2 20 12 2" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="stat-number" style={{ color: 'var(--status-urgent-text)' }}>
              {urgentCount}
            </div>
            <div className="stat-label">Urgent (Within 48h)</div>
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-icon-wrapper stat-icon-upcoming">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="stat-number" style={{ color: 'var(--status-upcoming-text)' }}>
              {upcomingCount}
            </div>
            <div className="stat-label">Upcoming Scheduled</div>
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-icon-wrapper stat-icon-expired">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <div className="stat-number" style={{ color: 'var(--status-expired-text)' }}>
              {expiredCount}
            </div>
            <div className="stat-label">Past / Expired</div>
          </div>
        </div>
      </div>

      {/* Quick AI Weekly Summary CTA Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          color: '#ffffff',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h3 style={{ color: '#ffffff', fontSize: 'var(--font-size-lg)', marginBottom: '4px' }}>
            What do I need to know this week?
          </h3>
          <p style={{ color: '#dbeafe', fontSize: 'var(--font-size-sm)' }}>
            Generate a short, intelligent executive digest of upcoming deadlines and schedule updates.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          style={{ backgroundColor: '#ffffff', color: '#1e40af', fontWeight: 600 }}
          onClick={onNavigateToSummary}
        >
          View Weekly Summary →
        </button>
      </div>

      {/* Section 1: Today's Important Updates */}
      <section className="pulse-section">
        <div className="pulse-section-title">
          <h2>Today&apos;s Important Updates</h2>
          {todayNotices.length > 0 && (
            <span className="badge badge-urgent">{todayNotices.length} active</span>
          )}
        </div>

        {todayNotices.length === 0 ? (
          <EmptyState
            title="All clear for today!"
            description="You have no urgent deadlines or events scheduled for today. Great job staying ahead!"
            actionText="Browse All Notices"
            onAction={onNavigateToAll}
          />
        ) : (
          <div className="notice-list">
            {todayNotices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                priority={priorities.get(notice.id)!}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Next Upcoming Deadlines */}
      <section className="pulse-section">
        <div className="pulse-section-title">
          <h2>Upcoming Deadlines</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onNavigateToAll}
          >
            View all →
          </button>
        </div>

        {next5Deadlines.length === 0 ? (
          <EmptyState
            title="No upcoming deadlines recorded"
            description="Add assignment notices or exam dates to track countdowns automatically."
            actionText="Add Announcement"
            onAction={onNavigateToAdd}
          />
        ) : (
          <div className="notice-list">
            {next5Deadlines.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                priority={priorities.get(notice.id)!}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
