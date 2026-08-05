import type { Page } from "@playwright/test";

/**
 * Wait until React has finished flushing its streaming SSR output, so that
 * every `data-testid` in the document resolves to exactly one element.
 *
 * **When to use**: call `gotoSettled` / `reloadSettled` instead of plain
 * `page.goto` / `page.reload` when navigating to a page whose layout is an
 * async server component — every `/admin/*` page, in practice — and the test
 * then queries the DOM. Navigations that only assert on the resulting URL
 * (redirect checks) do not need it.
 *
 * ## Why this is needed
 *
 * `cacheComponents` is enabled (see `next.config.ts`), so anything that reads
 * request data — `getServerSession`, `cookies()`, `usePathname()` — renders as
 * a deferred Suspense hole rather than part of the static shell. On an admin
 * page that is essentially the whole tree: the root layout wraps `{children}`
 * in `<Suspense>` (`src/app/layout.tsx`), and `src/app/admin/layout.tsx` is an
 * async server component that awaits the session plus several Prisma counts.
 *
 * React streams the content of a deferred boundary in two parts:
 *
 *   1. a pending placeholder in position — `<!--$?--><template id="B:0">`
 *   2. later, at the end of `<body>`, the real markup parked in a hidden
 *      staging container — `<div hidden id="S:0">…</div>` — followed by a
 *      `$RC("B:0","S:0")` script that relocates it and drops the container.
 *
 * Meanwhile the client has the inline RSC payload (`self.__next_f.push(…)`)
 * and renders the same subtree in place. So between the staging container
 * being parsed and React clearing it, the admin layout subtree exists twice:
 * once live and visible, once inside `div[hidden]`. Every `data-testid` under
 * it — `admin-page-header`, `survey-actions-<id>`, survey titles — resolves to
 * two elements, and Playwright throws a strict-mode violation without
 * retrying.
 *
 * Measured on `/admin/surveys` against the dev server: the window opens
 * ~300ms into the load and lasts ~105-150ms, on *every* load. It is only
 * intermittent in CI because whether a locator happens to be evaluated inside
 * that window depends on machine load.
 *
 * ## Why it is not fixed at the source
 *
 * This is a React streaming/hydration intermediate state, not an application
 * defect. The server sends exactly one copy of the subtree (verified by
 * dumping the SSR HTML: one `admin-page-header` occurrence), and the extra
 * copy lives inside React's own `<div hidden>` staging container, so it is
 * never laid out or painted — 0x0 rect, null `offsetParent`, no flicker for
 * admins. There is no app-level restructuring that avoids it: the admin
 * layout cannot join the static shell while it awaits the session, and the
 * page's own data would stream regardless.
 *
 * `.filter({ visible: true })` works for individual locators (the established
 * convention elsewhere in this suite), but it cannot be applied uniformly —
 * on a `not.toBeVisible()` assertion it is tautological. Waiting for the
 * stream to settle fixes every locator on the page at once and keeps the
 * assertions saying what they mean.
 */
export async function waitForStreamSettled(page: Page, timeout = 15_000) {
  await page.waitForFunction(
    () => {
      if (document.readyState !== "complete") return false;
      // React parks not-yet-relocated boundary content in `<div hidden>`
      // containers appended to <body>. Match structurally rather than on the
      // `S:` id prefix so this keeps working if React renames them.
      return !Array.from(
        document.querySelectorAll("body > div[hidden]")
      ).some((staged) => staged.querySelector("[data-testid]"));
    },
    undefined,
    { timeout }
  );
}

/** `page.goto` followed by {@link waitForStreamSettled}. */
export async function gotoSettled(page: Page, url: string) {
  await page.goto(url);
  await waitForStreamSettled(page);
}

/** `page.reload` followed by {@link waitForStreamSettled}. */
export async function reloadSettled(page: Page) {
  await page.reload();
  await waitForStreamSettled(page);
}
