import { useSyncExternalStore } from "react";
import { useSession, type SessionContextValue } from "next-auth/react";

const subscribeNoop = () => () => {};

/**
 * `useSession()` that reports `"loading"` until the calling component has
 * hydrated, so session-dependent markup always matches the server HTML.
 *
 * SessionProvider has no server session, so every server render sees
 * `"loading"`. A component inside a `<Suspense>` boundary that hydrates late
 * (e.g. the footer, which streams after the page content) can otherwise
 * hydrate after SessionProvider has fetched `/api/auth/session` and render
 * the signed-in branch over signed-out server HTML - a React hydration
 * mismatch that throws away and client-renders the whole boundary.
 *
 * During hydration `useSyncExternalStore` returns the server snapshot
 * (`false`), then re-renders with the client snapshot (`true`). Components
 * that mount on the client without hydrating (e.g. after a soft navigation)
 * get the real session on their first render, with no loading flash.
 */
export function useHydrationSafeSession(): SessionContextValue {
  const session = useSession();
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  if (!hydrated) {
    return { data: null, status: "loading", update: session.update };
  }
  return session;
}
