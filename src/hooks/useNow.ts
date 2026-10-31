import { useState, useEffect } from 'react';

/**
 * Shared clock hook that emits the current timestamp every intervalMs (defaults to 60s).
 * Avoids creating individual per-card intervals.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
