import { useCallback, useState } from "react";

/**
 * State that snaps back to `initialValue` whenever `resetKey` changes, e.g. a
 * page number that returns to 1 when the filters change. The reset is derived
 * during render, so there is no extra render with the stale value and no
 * effect needed to keep the two in sync.
 */
export function useResettableState<T>(initialValue: T, resetKey: unknown) {
  const [state, setState] = useState({ resetKey, value: initialValue });
  const value = Object.is(state.resetKey, resetKey) ? state.value : initialValue;

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      setState((prev) => {
        const current = Object.is(prev.resetKey, resetKey)
          ? prev.value
          : initialValue;
        return {
          resetKey,
          value:
            typeof next === "function"
              ? (next as (current: T) => T)(current)
              : next,
        };
      });
    },
    [initialValue, resetKey]
  );

  return [value, setValue] as const;
}
