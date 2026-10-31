import React from 'react';

interface StatusRegionProps {
  message: string | null;
  errorMessage: string | null;
}

/**
 * Accessible live announcement region.
 * Uses polite aria-live for status updates and role="alert" for errors.
 */
export const StatusRegion: React.FC<StatusRegionProps> = ({ message, errorMessage }) => {
  return (
    <>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </div>
      {errorMessage && (
        <div
          className="sr-only"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {errorMessage}
        </div>
      )}
    </>
  );
};
