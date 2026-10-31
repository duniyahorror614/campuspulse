import React, { useState } from 'react';
import type { Notice } from '../../shared/schema.js';
import type { PriorityInfo } from '../../shared/priority.js';
import { NoticeCard } from './NoticeCard.js';
import { EmptyState } from './EmptyState.js';

interface NoticeListProps {
  notices: Notice[];
  priorities: Map<string, PriorityInfo>;
  onView: (notice: Notice) => void;
  onEdit: (notice: Notice) => void;
  onDelete: (id: string, title: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onEmptyAction?: () => void;
  emptyActionText?: string;
}

const PAGE_SIZE = 50;

export const NoticeList: React.FC<NoticeListProps> = ({
  notices,
  priorities,
  onView,
  onEdit,
  onDelete,
  emptyTitle = 'No notices found',
  emptyDescription = 'There are no notices matching your current view or filters.',
  onEmptyAction,
  emptyActionText,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  if (notices.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionText={emptyActionText}
        onAction={onEmptyAction}
      />
    );
  }

  const visibleNotices = notices.slice(0, visibleCount);
  const hasMore = notices.length > visibleCount;

  return (
    <div className="notice-list-wrapper">
      <div className="notice-list">
        {visibleNotices.map((notice) => {
          const priority = priorities.get(notice.id) || {
            status: 'Unscheduled',
            nearestMomentMs: null,
            keyDate: null,
            countdownText: null,
            isDueToday: false,
          };

          return (
            <NoticeCard
              key={notice.id}
              notice={notice}
              priority={priority}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="pagination-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            Show 50 more ({notices.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
