import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State mirrored into localStorage.
 *
 * Writes are debounced because the stored value can be a multi-megabyte
 * environment report and the original version wrote it on every keystroke.
 * Storage failures (private browsing, quota, disabled storage) are swallowed:
 * persistence is a convenience, never a requirement for the app to work.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  options: { debounceMs?: number } = {},
): [T, (value: T) => void, () => void] {
  const { debounceMs = 400 } = options;

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial : (JSON.parse(stored) as T);
    } catch {
      return initial;
    }
  });

  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage is unavailable or full; the session still works in memory.
      }
    }, debounceMs);

    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, [key, value, debounceMs]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to do.
    }
    setValue(initial);
  }, [key, initial]);

  return [value, setValue, clear];
}
