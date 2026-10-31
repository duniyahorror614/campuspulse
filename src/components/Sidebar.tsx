import React, { useState } from 'react';

export type AppView = 'pulse' | 'all' | 'upcoming' | 'summary' | 'add';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  urgentCount: number;
  totalCount: number;
  onExportJson: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  urgentCount,
  totalCount,
  onExportJson,
}) => {
  const [showPriorityHelp, setShowPriorityHelp] = useState(false);

  return (
    <aside className="app-sidebar" aria-label="Sidebar Navigation">
      <div className="sidebar-header">
        <a href="#main-content" className="brand-title" onClick={(e) => { e.preventDefault(); onNavigate('pulse'); }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>Campus Pulse</span>
        </a>
        <div className="brand-tagline">
          Everything happening on campus. One intelligent place.
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main Navigation">
        <button
          type="button"
          className={`nav-item-btn ${currentView === 'pulse' ? 'active' : ''}`}
          onClick={() => onNavigate('pulse')}
          aria-current={currentView === 'pulse' ? 'page' : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span style={{ flex: 1 }}>Today&apos;s Pulse</span>
          {urgentCount > 0 && (
            <span className="badge badge-urgent" style={{ fontSize: '10px', padding: '2px 6px' }}>
              {urgentCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`nav-item-btn ${currentView === 'all' ? 'active' : ''}`}
          onClick={() => onNavigate('all')}
          aria-current={currentView === 'all' ? 'page' : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span style={{ flex: 1 }}>All Notices</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-subtle)' }}>
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          className={`nav-item-btn ${currentView === 'upcoming' ? 'active' : ''}`}
          onClick={() => onNavigate('upcoming')}
          aria-current={currentView === 'upcoming' ? 'page' : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Upcoming Events</span>
        </button>

        <button
          type="button"
          className={`nav-item-btn ${currentView === 'summary' ? 'active' : ''}`}
          onClick={() => onNavigate('summary')}
          aria-current={currentView === 'summary' ? 'page' : undefined}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>Weekly Digest</span>
        </button>

        <button
          type="button"
          className={`nav-item-btn ${currentView === 'add' ? 'active' : ''}`}
          onClick={() => onNavigate('add')}
          aria-current={currentView === 'add' ? 'page' : undefined}
          style={{ marginTop: '8px', border: '1px dashed var(--color-primary)', color: 'var(--color-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Announcement</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="footer-btn"
          onClick={() => setShowPriorityHelp(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>How priorities work</span>
        </button>

        <button
          type="button"
          className="footer-btn"
          onClick={onExportJson}
          title="Download all stored notices as JSON"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export JSON</span>
        </button>
      </div>

      {showPriorityHelp && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div className="modal-card">
            <div className="modal-header">
              <h3 id="help-title">How Campus Pulse Priorities Work</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPriorityHelp(false)}
                aria-label="Close help"
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                Priority is computed purely and authoritatively from dates in your local timezone. AI never invents priority labels.
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <strong style={{ color: 'var(--status-urgent-badge)' }}>Urgent:</strong> The notice is not expired AND its nearest future relevant moment (event or deadline) is within <strong>48 hours</strong> of now. A deadline with no specified time due today remains Urgent until 23:59:59.
                </li>
                <li>
                  <strong style={{ color: 'var(--status-upcoming-badge)' }}>Upcoming:</strong> The notice is active and its nearest future relevant moment is more than 48 hours away.
                </li>
                <li>
                  <strong style={{ color: 'var(--status-expired-badge)' }}>Expired:</strong> All relevant moments (event datetime and deadline datetime) are strictly in the past.
                </li>
                <li>
                  <strong style={{ color: 'var(--status-unscheduled-badge)' }}>Unscheduled:</strong> No event date and no deadline date were specified.
                </li>
                <li>
                  <strong>Multiple dates rule:</strong> If both an event date and a deadline exist, the nearest FUTURE moment is evaluated. If one has passed but the other is future, the notice is not expired.
                </li>
              </ul>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowPriorityHelp(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
