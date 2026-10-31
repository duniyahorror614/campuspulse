import React from 'react';
import type { NoticeStatus } from '../../shared/priority.js';

interface PriorityBadgeProps {
  status: NoticeStatus;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ status }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'Urgent':
        return {
          className: 'badge badge-urgent',
          label: 'Urgent',
          icon: (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 22 20 2 20 12 2" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
        };
      case 'Upcoming':
        return {
          className: 'badge badge-upcoming',
          label: 'Upcoming',
          icon: (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        };
      case 'Expired':
        return {
          className: 'badge badge-expired',
          label: 'Expired',
          icon: (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ),
        };
      case 'Unscheduled':
      default:
        return {
          className: 'badge badge-unscheduled',
          label: 'Unscheduled',
          icon: (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          ),
        };
    }
  };

  const { className, label, icon } = getBadgeConfig();

  return (
    <span className={className}>
      {icon}
      <span>{label}</span>
    </span>
  );
};
