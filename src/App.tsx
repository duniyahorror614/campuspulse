import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Notice, DraftNotice, Category } from '../shared/schema.js';
import type { PriorityInfo, NoticeStatus } from '../shared/priority.js';
import { classifyNotice } from '../shared/priority.js';
import { getDateStringInTimezone } from '../shared/dates.js';
import { useNotices } from './hooks/useNotices.js';
import { useNow } from './hooks/useNow.js';
import { useDebouncedValue } from './hooks/useDebouncedValue.js';
import { buildSearchIndex, searchNotices } from './lib/search.js';
import { checkHealth, requestExtractNotices } from './lib/apiClient.js';

import { Sidebar, AppView } from './components/Sidebar.js';
import { StatusRegion } from './components/StatusRegion.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { NoticeDetail } from './components/NoticeDetail.js';
import { NoticeForm } from './components/NoticeForm.js';
import { NoticeList } from './components/NoticeList.js';
import { Filters, FilterState } from './components/Filters.js';
import { SmartInput } from './components/SmartInput.js';
import { ReviewDrafts } from './components/ReviewDrafts.js';
import { TodayPulse } from './components/TodayPulse.js';
import { WeeklySummary } from './components/WeeklySummary.js';

export const App: React.FC = () => {
  const {
    notices,
    isLoaded,
    storageWarning,
    addNotice,
    addNoticesBatch,
    updateNotice,
    deleteNotice,
    exportNotices,
    dismissStorageWarning,
  } = useNotices();

  const nowMs = useNow(60_000);
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const referenceDate = useMemo(
    () => getDateStringInTimezone(nowMs, timezone),
    [nowMs, timezone]
  );

  // Health and AI status
  const [isAiAvailable, setIsAiAvailable] = useState<boolean>(false);
  useEffect(() => {
    checkHealth().then((res) => {
      setIsAiAvailable(res.aiAvailable);
    });
  }, []);

  // View state: defaults to 'add' (Smart Input) for new users with 0 notices
  const [currentView, setCurrentView] = useState<AppView>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('campusPulse.notices.v1') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return 'pulse';
        }
      }
    } catch {
      // ignore
    }
    return 'add';
  });

  // Status and Live Announcements
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const announce = useCallback((msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
    } else {
      setStatusMessage(msg);
    }
  }, []);

  // Urgent Banner Dismissal per day
  const [dismissedUrgentDate, setDismissedUrgentDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem('campusPulse.dismissedUrgentDate');
    } catch {
      return null;
    }
  });

  const handleDismissUrgentBanner = () => {
    try {
      localStorage.setItem('campusPulse.dismissedUrgentDate', referenceDate);
    } catch {
      // Ignore localStorage error
    }
    setDismissedUrgentDate(referenceDate);
  };

  // Modals & Forms State
  const [selectedNoticeForDetail, setSelectedNoticeForDetail] = useState<Notice | null>(null);
  const [noticeForEdit, setNoticeForEdit] = useState<Notice | null>(null);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [prefilledManualText, setPrefilledManualText] = useState('');
  const [noticeToDelete, setNoticeToDelete] = useState<{ id: string; title: string } | null>(null);

  // Extraction State
  const [extracting, setExtracting] = useState(false);
  const [draftNotices, setDraftNotices] = useState<DraftNotice[]>([]);

  // Filter State
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    selectedCategories: new Set<Category>(),
    selectedStatuses: new Set<NoticeStatus>(),
    startDate: '',
    endDate: '',
  });

  const debouncedQuery = useDebouncedValue(filterState.searchQuery, 250);

  // Priorities precomputation
  const prioritiesMap = useMemo(() => {
    const map = new Map<string, PriorityInfo>();
    for (const notice of notices) {
      map.set(notice.id, classifyNotice(notice, nowMs, timezone));
    }
    return map;
  }, [notices, nowMs, timezone]);

  // Urgent items count for sidebar & banner
  const urgentCount = useMemo(() => {
    let count = 0;
    for (const p of prioritiesMap.values()) {
      if (p.status === 'Urgent') count++;
    }
    return count;
  }, [prioritiesMap]);

  // Search indexing: O(n) once when notices change
  const searchIndex = useMemo(() => buildSearchIndex(notices), [notices]);

  // Search filtering: O(n * m)
  const searchResults = useMemo(
    () => searchNotices(searchIndex, debouncedQuery),
    [searchIndex, debouncedQuery]
  );

  // Multi-facet Filter + Sort
  const filteredAndSortedNotices = useMemo(() => {
    const { selectedCategories, selectedStatuses, startDate, endDate } = filterState;

    const filtered = searchResults.filter((notice) => {
      const p = prioritiesMap.get(notice.id);
      if (!p) return false;

      // Category filter
      if (selectedCategories.size > 0 && !selectedCategories.has(notice.category)) {
        return false;
      }

      // Status filter
      if (selectedStatuses.size > 0 && !selectedStatuses.has(p.status)) {
        return false;
      }

      // Date range filter: matches if notice eventDate, deadlineDate, or keyDate is in range
      if (startDate || endDate) {
        const inRange = (d: string | null) => Boolean(d && (!startDate || d >= startDate) && (!endDate || d <= endDate));
        const hasDateInRange = inRange(notice.eventDate) || inRange(notice.deadlineDate) || inRange(p.keyDate);
        if (!hasDateInRange) {
          return false;
        }
      }

      return true;
    });

    // Stable sort
    filtered.sort((a, b) => {
      const pa = prioritiesMap.get(a.id)!;
      const pb = prioritiesMap.get(b.id)!;

      if (currentView === 'upcoming') {
        const ma = pa.nearestMomentMs || Number.MAX_SAFE_INTEGER;
        const mb = pb.nearestMomentMs || Number.MAX_SAFE_INTEGER;
        return ma - mb;
      }

      // Default sorting:
      // Active (Urgent / Upcoming) by keyDate ascending
      // Expired by keyDate descending
      // Unscheduled by createdAt descending
      const orderRank: Record<NoticeStatus, number> = {
        Urgent: 0,
        Upcoming: 1,
        Unscheduled: 2,
        Expired: 3,
      };

      const rankDiff = orderRank[pa.status] - orderRank[pb.status];
      if (rankDiff !== 0) return rankDiff;

      if (pa.status === 'Expired') {
        const ma = pa.nearestMomentMs || 0;
        const mb = pb.nearestMomentMs || 0;
        return mb - ma; // Descending
      }

      if (pa.status === 'Unscheduled') {
        return b.createdAt.localeCompare(a.createdAt);
      }

      const ma = pa.nearestMomentMs || 0;
      const mb = pb.nearestMomentMs || 0;
      return ma - mb; // Ascending
    });

    return filtered;
  }, [searchResults, prioritiesMap, filterState, currentView]);

  // Upcoming view specific subset
  const upcomingNotices = useMemo(() => {
    return notices
      .filter((n) => {
        const p = prioritiesMap.get(n.id);
        return p && (p.status === 'Upcoming' || p.status === 'Urgent');
      })
      .sort((a, b) => {
        const ma = prioritiesMap.get(a.id)?.nearestMomentMs || 0;
        const mb = prioritiesMap.get(b.id)?.nearestMomentMs || 0;
        return ma - mb;
      });
  }, [notices, prioritiesMap]);

  // AI Extraction handler
  const handleExtract = async (text: string) => {
    setExtracting(true);
    setErrorMessage(null);
    announce('Extracting notice with AI...');

    const res = await requestExtractNotices(text, referenceDate, timezone);
    setExtracting(false);

    if (res.success && res.data) {
      if (res.data.length === 0) {
        announce('No announcements detected in the text.', true);
      } else {
        setDraftNotices(res.data);
        announce(`Successfully extracted ${res.data.length} draft notice(s). Please review.`);
      }
    } else {
      announce(res.message || 'Failed to extract notice with AI.', true);
    }
  };

  // Draft saving
  const handleSaveDraftNotice = (notice: Notice) => {
    addNotice(notice);
    setDraftNotices((prev) => prev.filter((d) => d.id !== notice.id));
    announce(`Saved notice "${notice.title}".`);
  };

  const handleSaveAllDrafts = (noticesToSave: Notice[]) => {
    addNoticesBatch(noticesToSave);
    setDraftNotices([]);
    announce(`Saved ${noticesToSave.length} notices.`);
    setCurrentView('all');
  };

  const handleDiscardDraft = (draftId: string) => {
    setDraftNotices((prev) => prev.filter((d) => d.id !== draftId));
    announce('Discarded draft.');
  };

  const handleDiscardAllDrafts = () => {
    setDraftNotices([]);
    announce('Discarded all drafts.');
  };

  // Manual Creation / Edit
  const handleSaveFormNotice = (notice: Notice) => {
    if (noticeForEdit) {
      updateNotice(notice);
      announce(`Updated notice "${notice.title}".`);
    } else {
      addNotice(notice);
      announce(`Added notice "${notice.title}".`);
    }
    setNoticeForEdit(null);
    setIsManualFormOpen(false);
    setPrefilledManualText('');
  };

  // Delete flow
  const handleDeleteNotice = (id: string, title: string) => {
    setNoticeToDelete({ id, title });
  };

  const confirmDelete = () => {
    if (noticeToDelete) {
      deleteNotice(noticeToDelete.id);
      announce(`Deleted notice "${noticeToDelete.title}".`);
      setNoticeToDelete(null);
      if (selectedNoticeForDetail?.id === noticeToDelete.id) {
        setSelectedNoticeForDetail(null);
      }
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '32px', height: '32px', marginBottom: '16px', color: 'var(--color-primary)' }} />
          <div>Loading Campus Pulse...</div>
        </div>
      </div>
    );
  }

  const showUrgentBanner = urgentCount > 0 && dismissedUrgentDate !== referenceDate;

  return (
    <div className="app-container">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <StatusRegion message={statusMessage} errorMessage={errorMessage} />

      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        urgentCount={urgentCount}
        totalCount={notices.length}
        onExportJson={exportNotices}
      />

      <div className="app-main">
        {/* Urgent reminder banner */}
        {showUrgentBanner && (
          <aside className="urgent-banner" role="alert" aria-label="Urgent campus notice alert">
            <div className="urgent-banner-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 22 20 2 20 12 2" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                <strong>Attention:</strong> You have {urgentCount} urgent deadline
                {urgentCount === 1 ? '' : 's'} or event{urgentCount === 1 ? '' : 's'} happening within the next 48 hours!
              </span>
            </div>
            <button
              type="button"
              className="urgent-banner-dismiss"
              onClick={handleDismissUrgentBanner}
              aria-label="Dismiss urgent notice banner for today"
            >
              Dismiss for today
            </button>
          </aside>
        )}

        {/* Storage failure banner */}
        {storageWarning && (
          <aside className="storage-banner" role="alert">
            <span>{storageWarning}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={dismissStorageWarning}
              aria-label="Dismiss storage warning"
            >
              ✕
            </button>
          </aside>
        )}

        <main id="main-content" className="main-content" tabIndex={-1}>
          {currentView === 'pulse' && (
            <div>
              <div className="view-header">
                <div className="view-header-content">
                  <h1>Today&apos;s Pulse</h1>
                  <p className="view-subtitle">
                    Campus overview for {referenceDate} ({timezone})
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentView('add')}
                >
                  + Add Announcement
                </button>
              </div>

              <TodayPulse
                notices={notices}
                priorities={prioritiesMap}
                onView={(n) => setSelectedNoticeForDetail(n)}
                onEdit={(n) => setNoticeForEdit(n)}
                onDelete={handleDeleteNotice}
                onNavigateToAll={() => setCurrentView('all')}
                onNavigateToAdd={() => setCurrentView('add')}
                onNavigateToSummary={() => setCurrentView('summary')}
              />
            </div>
          )}

          {currentView === 'all' && (
            <div>
              <div className="view-header">
                <div className="view-header-content">
                  <h1>All Campus Notices</h1>
                  <p className="view-subtitle">
                    Search and filter all stored campus announcements
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentView('add')}
                >
                  + Add Announcement
                </button>
              </div>

              <Filters
                filterState={filterState}
                onFilterChange={setFilterState}
                totalFilteredCount={filteredAndSortedNotices.length}
              />

              <NoticeList
                notices={filteredAndSortedNotices}
                priorities={prioritiesMap}
                onView={(n) => setSelectedNoticeForDetail(n)}
                onEdit={(n) => setNoticeForEdit(n)}
                onDelete={handleDeleteNotice}
                emptyTitle={notices.length === 0 ? 'No campus notices yet' : 'No matching notices'}
                emptyDescription={
                  notices.length === 0
                    ? 'Start by pasting a WhatsApp notice or email to organise your semester.'
                    : 'Try clearing your search terms or relaxing category and status filters.'
                }
                emptyActionText={notices.length === 0 ? 'Paste Announcement' : 'Clear Filters'}
                onEmptyAction={
                  notices.length === 0
                    ? () => setCurrentView('add')
                    : () =>
                        setFilterState({
                          searchQuery: '',
                          selectedCategories: new Set(),
                          selectedStatuses: new Set(),
                          startDate: '',
                          endDate: '',
                        })
                }
              />
            </div>
          )}

          {currentView === 'upcoming' && (
            <div>
              <div className="view-header">
                <div className="view-header-content">
                  <h1>Upcoming Events &amp; Deadlines</h1>
                  <p className="view-subtitle">
                    Chronological order of future scheduled campus activities
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCurrentView('add')}
                >
                  + Add Announcement
                </button>
              </div>

              <NoticeList
                notices={upcomingNotices}
                priorities={prioritiesMap}
                onView={(n) => setSelectedNoticeForDetail(n)}
                onEdit={(n) => setNoticeForEdit(n)}
                onDelete={handleDeleteNotice}
                emptyTitle="No upcoming events scheduled"
                emptyDescription="There are no future events or deadlines pending. Add one to track its countdown."
                emptyActionText="Add Announcement"
                onEmptyAction={() => setCurrentView('add')}
              />
            </div>
          )}

          {currentView === 'summary' && (
            <div>
              <div className="view-header">
                <div className="view-header-content">
                  <h1>AI Weekly Campus Summary</h1>
                  <p className="view-subtitle">
                    &quot;What do I need to know this week?&quot; — concise briefing grounded on your notices
                  </p>
                </div>
              </div>

              <WeeklySummary
                notices={notices}
                referenceDate={referenceDate}
                timezone={timezone}
                isAiAvailable={isAiAvailable}
                onViewNoticeById={(id) => {
                  const notice = notices.find((n) => n.id === id);
                  if (notice) setSelectedNoticeForDetail(notice);
                }}
                onNavigateToAdd={() => setCurrentView('add')}
              />
            </div>
          )}

          {currentView === 'add' && (
            <div>
              <div className="view-header">
                <div className="view-header-content">
                  <h1>Smart Campus Input</h1>
                  <p className="view-subtitle">
                    Tagline: &quot;Everything happening on campus. One intelligent place.&quot;
                  </p>
                </div>
              </div>

              {draftNotices.length > 0 && (
                <ReviewDrafts
                  drafts={draftNotices}
                  existingNotices={notices}
                  onSaveNotice={handleSaveDraftNotice}
                  onSaveAll={handleSaveAllDrafts}
                  onDiscardDraft={handleDiscardDraft}
                  onDiscardAll={handleDiscardAllDrafts}
                />
              )}

              <SmartInput
                referenceDate={referenceDate}
                isAiAvailable={isAiAvailable}
                isLoading={extracting}
                onExtract={handleExtract}
                onManualEntry={(prefill) => {
                  setPrefilledManualText(prefill || '');
                  setIsManualFormOpen(true);
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Notice Detail View */}
      {selectedNoticeForDetail && (
        <NoticeDetail
          notice={selectedNoticeForDetail}
          priority={prioritiesMap.get(selectedNoticeForDetail.id) || null}
          onClose={() => setSelectedNoticeForDetail(null)}
          onEdit={(n) => {
            setSelectedNoticeForDetail(null);
            setNoticeForEdit(n);
          }}
          onDelete={(id, title) => {
            setSelectedNoticeForDetail(null);
            handleDeleteNotice(id, title);
          }}
        />
      )}

      {/* Manual Notice Creation / Edit Modal */}
      {(isManualFormOpen || noticeForEdit) && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <NoticeForm
            initialNotice={noticeForEdit}
            initialOriginalText={prefilledManualText}
            onSave={handleSaveFormNotice}
            onCancel={() => {
              setNoticeForEdit(null);
              setIsManualFormOpen(false);
              setPrefilledManualText('');
            }}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(noticeToDelete)}
        title="Delete Campus Notice"
        message={`Are you sure you want to delete "${noticeToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Notice"
        cancelLabel="Keep Notice"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setNoticeToDelete(null)}
      />
    </div>
  );
};
