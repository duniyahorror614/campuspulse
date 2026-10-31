import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoticeList } from '../src/components/NoticeList.js';
import { NoticeCard } from '../src/components/NoticeCard.js';
import { ConfirmDialog } from '../src/components/ConfirmDialog.js';
import { Filters, FilterState } from '../src/components/Filters.js';
import type { Notice } from '../shared/schema.js';
import type { PriorityInfo } from '../shared/priority.js';

describe('Critical React Component Tests', () => {
  const dummyPriority: PriorityInfo = {
    status: 'Upcoming',
    nearestMomentMs: Date.now() + 100000,
    keyDate: '2026-11-05',
    countdownText: '4 days left',
    isDueToday: false,
  };

  const dummyNotice: Notice = {
    id: 'notice-1',
    title: 'CS101 Problem Set 4',
    description: 'Submit on Canvas before 5pm.',
    category: 'Assignment',
    eventDate: null,
    eventTime: null,
    venue: null,
    deadlineDate: '2026-11-05',
    deadlineTime: '17:00',
    originalText: 'Pasted text',
    contentHash: 'hash1',
    reviewRequired: true,
    reviewWarnings: ['Date is ambiguous in original message'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders empty state when NoticeList has zero notices', () => {
    render(
      <NoticeList
        notices={[]}
        priorities={new Map()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        emptyTitle="No notices available"
        emptyDescription="Start by adding announcements."
      />
    );

    expect(screen.getByText('No notices available')).toBeInTheDocument();
    expect(screen.getByText('Start by adding announcements.')).toBeInTheDocument();
  });

  it('renders review warning badge when notice has ambiguity warning', () => {
    render(
      <NoticeCard
        notice={dummyNotice}
        priority={dummyPriority}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('CS101 Problem Set 4')).toBeInTheDocument();
    expect(screen.getByText(/Date is ambiguous in original message/i)).toBeInTheDocument();
  });

  it('filters component updates query and announces count in aria-live', () => {
    const onFilterChange = vi.fn();
    const filterState: FilterState = {
      searchQuery: '',
      selectedCategories: new Set(),
      selectedStatuses: new Set(),
      startDate: '',
      endDate: '',
    };

    render(
      <Filters
        filterState={filterState}
        onFilterChange={onFilterChange}
        totalFilteredCount={14}
      />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'algorithms' } });

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ searchQuery: 'algorithms' })
    );

    expect(screen.getByText('14 notices found')).toBeInTheDocument();
  });

  it('ConfirmDialog shows message and requires explicit confirmation before triggering action', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        isOpen={false}
        title="Delete Notice"
        message="Are you sure you want to delete this notice?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.queryByText('Delete Notice')).toBeNull();

    rerender(
      <ConfirmDialog
        isOpen={true}
        title="Delete Notice"
        message="Are you sure you want to delete this notice?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Delete Notice')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: 'Confirm' });
    fireEvent.click(deleteBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});
