'use client';

import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly changing value. Used to throttle catalog full-text search
 * so keystrokes do not fire a request each, while still allowing the latest
 * value to win once typing pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return;
    }

    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
