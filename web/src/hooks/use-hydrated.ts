import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * `false` during SSR and hydration, `true` once the calling component has
 * hydrated - for markup that can only be known on the client (theme, session,
 * browser APIs) and must still match the server HTML.
 *
 * During hydration `useSyncExternalStore` returns the server snapshot, then
 * re-renders with the client snapshot. Components that mount on the client
 * without hydrating (e.g. after a soft navigation) get `true` on their first
 * render, with no placeholder flash.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}
