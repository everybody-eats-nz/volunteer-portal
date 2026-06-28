import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helpers for interacting with Radix/shadcn `<Select>` components in e2e tests.
 *
 * Radix renders the option list into a portal with an open animation, and the
 * options themselves are frequently populated from an async fetch. A naive
 * `trigger.click()` followed by `page.locator('[role="option"]').first().click()`
 * is racy: the generic, un-scoped option locator can resolve against a portal
 * that is still animating open (or a stale, hidden one), causing intermittent
 * click timeouts. These helpers open the listbox, wait for it to be visible and
 * populated, and scope the option lookup to that open listbox.
 */

interface SelectOptionTarget {
  /** Pick the option at this index within the open listbox. Defaults to 0. */
  index?: number;
  /** Pick the first option whose text matches. Takes precedence over `index`. */
  name?: string | RegExp;
}

/**
 * Opens the Select identified by `trigger`, waits for the listbox portal to be
 * open and populated, then clicks the requested option scoped to that listbox.
 */
export async function selectOption(
  trigger: Locator,
  target: SelectOptionTarget = {}
): Promise<void> {
  const page = trigger.page();

  await trigger.click();

  // Wait for the portal listbox to finish opening before touching options.
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();

  // Scope option lookups to the open listbox so we can never match a stale or
  // hidden portal left over from a previous interaction.
  const options = listbox.getByRole("option");
  await expect(options.first()).toBeVisible();

  const option =
    target.name !== undefined
      ? options.filter({ hasText: target.name }).first()
      : options.nth(target.index ?? 0);

  await expect(option).toBeVisible();
  await option.click();

  // The Radix popover closes on selection; wait for it so a following
  // interaction isn't blocked by the closing overlay.
  await expect(listbox).toBeHidden();
}

/** Convenience wrapper for the common "open and pick the first option" case. */
export async function selectFirstOption(trigger: Locator): Promise<void> {
  await selectOption(trigger, { index: 0 });
}
