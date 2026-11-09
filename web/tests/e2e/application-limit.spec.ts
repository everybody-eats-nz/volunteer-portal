import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createShift,
  createSignup,
  createTestUser,
  deleteSignupsByShiftIds,
  deleteTestShifts,
  deleteTestUsers,
  getShiftTypeByName,
  getUserByEmail,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

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

/**
 * The same rule against the real routes: a dedicated volunteer with five
 * genuine pending applications. The shifts are hand-picked (no auto-approval)
 * so the live rules can't confirm anything and take it off the pile.
 */
test.describe.configure({ timeout: 60_000 });
test.describe("Cap on open shift applications - server", () => {
  let volunteerEmail: string;
  let volunteerId: string;
  /** Five shifts the volunteer has applied for, then one they have not. */
  let shiftIds: string[];
  let nextShiftId: string;
  /** A one-place shift somebody else already holds. */
  let fullShiftId: string;

  test.beforeEach(async ({ page }) => {
    const testId = randomUUID().slice(0, 8);
    volunteerEmail = `volunteer-applimit-${testId}@example.com`;

    await loginAsAdmin(page);
    await createTestUser(page, volunteerEmail, "VOLUNTEER");
    volunteerId = (await getUserByEmail(page, volunteerEmail))!.id;
    const shiftType = await getShiftTypeByName(page, "Kitchen Prep");

    // One shift a day, so none of them clash with each other.
    shiftIds = [];
    for (let day = 0; day < 7; day++) {
      const start = new Date();
      start.setDate(start.getDate() + 5 + day);
      start.setHours(11, 0, 0, 0);
      const shift = await createShift(page, {
        location: "Wellington",
        start,
        capacity: day === 6 ? 1 : 4,
        shiftTypeId: shiftType?.id,
        notes: "Application limit server test shift",
        autoApprovalEnabled: false,
      });
      shiftIds.push(shift.id);
    }
    nextShiftId = shiftIds[5];
    fullShiftId = shiftIds[6];

    for (const shiftId of shiftIds.slice(0, 5)) {
      await createSignup(page, { userId: volunteerId, shiftId, status: "PENDING" });
    }
    const other = await getUserByEmail(page, "volunteer@example.com");
    await createSignup(page, {
      userId: other!.id,
      shiftId: fullShiftId,
      status: "CONFIRMED",
    });
  });

  test.afterEach(async ({ page }) => {
    await loginAsAdmin(page);
    await deleteSignupsByShiftIds(page, shiftIds);
    await deleteTestUsers(page, [volunteerEmail]);
    await deleteTestShifts(page, shiftIds);
  });

  test("web routes refuse a sixth application until one is withdrawn", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);

    const check = await page.request.get(
      `/api/shifts/${nextShiftId}/auto-approval-check`
    );
    expect((await check.json()).applicationLimit).toEqual({
      limit: 5,
      pending: 5,
      reached: true,
    });

    const refused = await page.request.post(`/api/shifts/${nextShiftId}/signup`);
    expect(refused.status()).toBe(400);
    const body = await refused.json();
    expect(body.applicationLimitReached).toBe(true);
    expect(body.error).toBe(LIMIT_MESSAGE);

    // Joining a waitlist is not an application, so the cap doesn't apply.
    const waitlisted = await page.request.post(
      `/api/shifts/${fullShiftId}/signup`,
      { form: { waitlist: "1" } }
    );
    expect(waitlisted.ok()).toBeTruthy();
    expect((await waitlisted.json()).status).toBe("WAITLISTED");

    // Withdrawing one application makes room for another.
    const withdrawn = await page.request.delete(
      `/api/shifts/${shiftIds[0]}/signup`
    );
    expect(withdrawn.ok()).toBeTruthy();

    const accepted = await page.request.post(`/api/shifts/${nextShiftId}/signup`);
    expect(accepted.ok()).toBeTruthy();
    expect((await accepted.json()).status).toBe("PENDING");

    // Re-applying for the withdrawn shift counts like any other application.
    const reapply = await page.request.post(`/api/shifts/${shiftIds[0]}/signup`);
    expect(reapply.status()).toBe(400);
    expect((await reapply.json()).applicationLimitReached).toBe(true);
  });

  test("mobile routes refuse a sixth application", async ({ page }) => {
    const login = await page.request.post("/api/auth/mobile/login", {
      data: { email: volunteerEmail, password: "Test123456" },
    });
    expect(login.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await login.json()).token}` };

    const check = await page.request.get(
      `/api/mobile/shifts/${nextShiftId}/auto-approval-check`,
      { headers }
    );
    expect((await check.json()).applicationLimit.reached).toBe(true);

    const refused = await page.request.post(
      `/api/mobile/shifts/${nextShiftId}/signup`,
      { headers, data: {} }
    );
    expect(refused.status()).toBe(400);
    const body = await refused.json();
    expect(body.applicationLimitReached).toBe(true);
    // Builds that predate the cap show this string as-is.
    expect(body.error).toBe(LIMIT_MESSAGE);

    const waitlisted = await page.request.post(
      `/api/mobile/shifts/${fullShiftId}/signup`,
      { headers, data: { waitlist: true } }
    );
    expect(waitlisted.ok()).toBeTruthy();
    expect((await waitlisted.json()).status).toBe("WAITLISTED");
  });
});
