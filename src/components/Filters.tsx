import React from 'react';
import { CATEGORIES, Category } from '../../shared/schema.js';
import type { NoticeStatus } from '../../shared/priority.js';

export interface FilterState {
  searchQuery: string;
  selectedCategories: Set<Category>;
  selectedStatuses: Set<NoticeStatus>;
  startDate: string;
  endDate: string;
}

interface FiltersProps {
  filterState: FilterState;
  onFilterChange: (next: FilterState) => void;
  totalFilteredCount: number;
}

const ALL_STATUSES: NoticeStatus[] = ['Urgent', 'Upcoming', 'Expired', 'Unscheduled'];

export const Filters: React.FC<FiltersProps> = ({
  filterState,
  onFilterChange,
  totalFilteredCount,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filterState,
      searchQuery: e.target.value,
    });
  };

  const toggleCategory = (cat: Category) => {
    const nextSet = new Set(filterState.selectedCategories);
    if (nextSet.has(cat)) {
      nextSet.delete(cat);
    } else {
      nextSet.add(cat);
    }
    onFilterChange({
      ...filterState,
      selectedCategories: nextSet,
    });
  };

  const toggleStatus = (status: NoticeStatus) => {
    const nextSet = new Set(filterState.selectedStatuses);
    if (nextSet.has(status)) {
      nextSet.delete(status);
    } else {
      nextSet.add(status);
    }
    onFilterChange({
      ...filterState,
      selectedStatuses: nextSet,
    });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filterState,
      startDate: e.target.value,
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filterState,
      endDate: e.target.value,
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      searchQuery: '',
      selectedCategories: new Set(),
      selectedStatuses: new Set(),
      startDate: '',
      endDate: '',
    });
  };

  const isFiltered =
    Boolean(filterState.searchQuery) ||
    filterState.selectedCategories.size > 0 ||
    filterState.selectedStatuses.size > 0 ||
    Boolean(filterState.startDate) ||
    Boolean(filterState.endDate);

  return (
    <div className="filters-container" role="search" aria-label="Notices filter controls">
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <label htmlFor="search-notices-input" className="sr-only">
          Search campus notices by title, description, venue, or category
        </label>
        <input
          id="search-notices-input"
          type="search"
          className="search-input"
          placeholder="Search by keywords, venue, or topic..."
          value={filterState.searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      <div className="filter-row">
        <div className="filter-group" role="group" aria-label="Filter by status">
          <span className="filter-label">Status:</span>
          {ALL_STATUSES.map((status) => {
            const active = filterState.selectedStatuses.has(status);
            return (
              <button
                key={status}
                type="button"
                className={`filter-chip ${active ? 'active' : ''}`}
                onClick={() => toggleStatus(status)}
                aria-pressed={active}
              >
                {status}
              </button>
            );
          })}
        </div>

        <div className="date-range-group" role="group" aria-label="Filter by date range">
          <span className="filter-label">Dates:</span>
          <label htmlFor="filter-start-date" className="sr-only">From date</label>
          <input
            id="filter-start-date"
            type="date"
            className="date-input"
            value={filterState.startDate}
            onChange={handleStartDateChange}
            aria-label="From date"
          />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-subtle)' }}>to</span>
          <label htmlFor="filter-end-date" className="sr-only">To date</label>
          <input
            id="filter-end-date"
            type="date"
            className="date-input"
            value={filterState.endDate}
            onChange={handleEndDateChange}
            aria-label="To date"
          />
        </div>

        <div className="filter-count-display" aria-live="polite" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>Found</span>
          <strong style={{ color: 'var(--color-primary)' }}>{totalFilteredCount}</strong>
          <span>notice{totalFilteredCount === 1 ? '' : 's'}</span>
        </div>

        {isFiltered && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearAllFilters}
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="filter-group" role="group" aria-label="Filter by category">
        <span className="filter-label">Categories:</span>
        {CATEGORIES.map((cat) => {
          const active = filterState.selectedCategories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              className={`filter-chip ${active ? 'active' : ''}`}
              onClick={() => toggleCategory(cat)}
              aria-pressed={active}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="sr-only" aria-live="polite">
        {totalFilteredCount} notice{totalFilteredCount === 1 ? '' : 's'} found
      </div>
    </div>
  );
};
