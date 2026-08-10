/**
 * Recovery policy for `app/global-error.tsx`.
 *
 * A global error means the whole React root — the App Router included — has
 * been torn down. Next's `reset()` only re-renders that same root in the same
 * JS context, so it cannot recover from a crash rooted in module-level React
 * state. The crash we see in production is exactly that: React's reconciler
 * value stack gets out of balance, `suspenseHandlerStackCursor.current` ends up
 * holding a lane number instead of a fiber, and the next `useDeferredValue`
 * mount inside Next's `<Head>` throws
 * `TypeError: Cannot create property 'flags' on number`. That state lives in
 * module scope, so it survives `reset()` and the app crashes again immediately —
 * leaving the volunteer stuck on the error screen with a button that does
 * nothing.
 *
 * A full document reload is the only reliable recovery. We take it
 * automatically, but only once per tab session, so an error that reproduces on
 * every load shows the message instead of reload-looping.
 */
const RELOAD_MARKER_KEY = "ee:global-error-reloaded";

type MarkerStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * Claims the one automatic reload allowed per tab session.
 *
 * Returns `true` the first time it is called for a session (and records the
 * claim), `false` afterwards or when session storage is unavailable — in which
 * case the error screen's manual reload button is the fallback.
 */
export function claimGlobalErrorAutoReload(
  storage: MarkerStorage | undefined | null
): boolean {
  if (!storage) return false;

  try {
    if (storage.getItem(RELOAD_MARKER_KEY) !== null) return false;
    storage.setItem(RELOAD_MARKER_KEY, "1");
    return true;
  } catch {
    // Storage blocked (private mode, cookie restrictions). Without a durable
    // marker we cannot detect a loop, so never auto-reload.
    return false;
  }
}
