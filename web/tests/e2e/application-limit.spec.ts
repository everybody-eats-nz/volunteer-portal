import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createShift,
  deleteTestShifts,
  getShiftTypeByName,
} from "./helpers/test-helpers";

const LIMIT_MESSAGE =
  "You have 5 shift applications waiting for a reply, which is the most you can have at once. Once one is confirmed, or you withdraw one, you can apply for another.";

/**
 * A volunteer may have at most 5 applications waiting on an admin. At the cap
 * the signup dialog says so and points at My Shifts instead of letting the
 * confirm button dead-end.
 *
 * The eligibility check and the signup POST are stubbed, so the shared seeded
 * volunteer never needs five real pending signups (which would starve the
 * other specs that sign the same account up).
 */
test.describe("Cap on open shift applications", () => {
  let shiftId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const shiftType = await getShiftTypeByName(page, "Kitchen Prep & Service");

    const start = new Date();
    start.setDate(start.getDate() + 4);
    start.setHours(10, 0, 0, 0);

    const shift = await createShift(page, {
      location: "Wellington",
      start,
      capacity: 4,
      shiftTypeId: shiftType?.id,
      notes: "Application limit test shift",
    });
    shiftId = shift.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await deleteTestShifts(page, [shiftId]);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);
  });

  async function stubEligibility(page: Page, json: Record<string, unknown>) {
    await page.route("**/api/shifts/*/auto-approval-check*", (route) =>
      route.fulfill({ json })
    );
  }

  async function openSignupDialog(page: Page) {
    await gotoSettled(page, `/shifts/${shiftId}`);
    await page.getByTestId("shift-signup-button").first().click();
    const dialog = page.getByTestId("shift-signup-dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("says so up front and blocks the signup at the cap", async ({ page }) => {
    await stubEligibility(page, {
      eligible: false,
      applicationLimit: { limit: 5, pending: 5, reached: true },
    });
    const dialog = await openSignupDialog(page);

    const notice = dialog.getByTestId("application-limit-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("You've reached the application limit");
    await expect(dialog.getByTestId("shift-signup-dialog-title")).toHaveText(
      "Application Limit Reached"
    );
    await expect(notice).toContainText(LIMIT_MESSAGE);
    await expect(
      notice.getByTestId("application-limit-my-shifts-button")
    ).toHaveAttribute("href", "/shifts/mine");

    await expect(dialog.getByTestId("shift-signup-confirm-button")).toBeDisabled();
    // Nothing to answer about waitlisting an application that can't be made.
    await expect(dialog.getByTestId("waitlist-if-full-checkbox")).toHaveCount(0);
    await expect(dialog.getByTestId("approval-process-info")).toHaveCount(0);
  });

  test("leaves the signup open below the cap", async ({ page }) => {
    await stubEligibility(page, {
      eligible: false,
      applicationLimit: { limit: 5, pending: 4, reached: false },
    });
    const dialog = await openSignupDialog(page);

    await expect(dialog.getByTestId("approval-process-info")).toBeVisible();
    await expect(dialog.getByTestId("application-limit-notice")).toHaveCount(0);
    await expect(dialog.getByTestId("shift-signup-confirm-button")).toBeEnabled();
  });

  test("shows the cap when the server refuses the signup", async ({ page }) => {
    // The pre-check saw room; the server, a moment later, did not.
    await stubEligibility(page, {
      eligible: false,
      applicationLimit: { limit: 5, pending: 4, reached: false },
    });
    await page.route(`**/api/shifts/${shiftId}/signup`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 400,
            json: {
              error: LIMIT_MESSAGE,
              applicationLimitReached: true,
              applicationLimit: { limit: 5, pending: 5, reached: true },
            },
          })
        : route.continue()
    );
    const dialog = await openSignupDialog(page);

    await dialog.getByTestId("shift-signup-confirm-button").click();

    await expect(dialog.getByTestId("application-limit-notice")).toBeVisible();
    // The dedicated notice replaces the generic "Something went wrong" panel.
    await expect(dialog.getByTestId("signup-error")).toHaveCount(0);
    await expect(dialog.getByTestId("shift-signup-confirm-button")).toBeDisabled();
  });
});
