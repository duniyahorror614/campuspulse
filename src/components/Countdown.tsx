import React from 'react';

interface CountdownProps {
  text: string | null;
  isUrgent?: boolean;
}

export const Countdown: React.FC<CountdownProps> = ({ text, isUrgent }) => {
  if (!text) return null;

  return (
    <span
      className={`countdown-indicator ${isUrgent ? 'countdown-urgent' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 500,
        color: isUrgent ? 'var(--status-urgent-badge)' : 'var(--color-text-muted)',
      }}
    >
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
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{text}</span>
    </span>
  );
};
