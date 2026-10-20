import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  createShift,
  deleteTestShifts,
  getShiftTypeByName,
} from "./helpers/test-helpers";

/**
 * Nobody lands on a waitlist they didn't choose:
 * - a signup that needs approval asks up front whether to wait if the shift
 *   fills before an admin gets to it (unticked by default);
 * - if the shift fills while the dialog is open, it switches to the waitlist
 *   view instead of showing a dead-end error.
 *
 * The signup POST and the eligibility check are stubbed, so the shared seeded
 * volunteer never actually signs up and the live auto-approval rules can't
 * turn this into an instant signup.
 */
test.describe("Waitlist opt-in at signup", () => {
  let shiftId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const shiftType = await getShiftTypeByName(page, "Kitchen Prep & Service");

    const start = new Date();
    start.setDate(start.getDate() + 3);
    start.setHours(10, 0, 0, 0);

    const shift = await createShift(page, {
      location: "Wellington",
      start,
      capacity: 4,
      shiftTypeId: shiftType?.id,
      notes: "Waitlist opt-in test shift",
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
    await page.route("**/api/shifts/*/auto-approval-check*", (route) =>
      route.fulfill({ json: { eligible: false } })
    );
  });

  /** Stub the signup POST with one response per call, recording each body. */
  async function stubSignup(
    page: Page,
    responses: Array<{ status: number; json: Record<string, unknown> }>
  ): Promise<string[]> {
    const bodies: string[] = [];
    await page.route(`**/api/shifts/${shiftId}/signup`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      bodies.push(route.request().postData() ?? "");
      const next = responses[Math.min(bodies.length, responses.length) - 1];
      await route.fulfill(next);
    });
    return bodies;
  }

  async function openSignupDialog(page: Page) {
    await gotoSettled(page, `/shifts/${shiftId}`);
    await page.getByTestId("shift-signup-button").first().click();
    const dialog = page.getByTestId("shift-signup-dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /** Read one field out of a multipart form body. */
  function formField(body: string, name: string): string | null {
    const match = body.match(
      new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`)
    );
    return match ? match[1] : null;
  }

  test("asks whether to wait if the shift fills, unticked by default", async ({
    page,
  }) => {
    const bodies = await stubSignup(page, [
      { status: 200, json: { id: "s1", status: "PENDING", autoApproved: false } },
    ]);
    const dialog = await openSignupDialog(page);

    const optIn = dialog.getByTestId("waitlist-if-full-checkbox");
    await expect(optIn).toBeVisible();
    await expect(optIn).toHaveAttribute("data-state", "unchecked");
    await expect(dialog).toContainText("Put me on the waitlist if it fills up");

    await optIn.click();
    await expect(optIn).toHaveAttribute("data-state", "checked");

    await dialog.getByTestId("shift-signup-confirm-button").click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(formField(bodies[0], "waitlistIfFull")).toBe("1");
    expect(formField(bodies[0], "waitlist")).toBeNull();
  });

  test("sends an explicit no when the box is left unticked", async ({
    page,
  }) => {
    const bodies = await stubSignup(page, [
      { status: 200, json: { id: "s1", status: "PENDING", autoApproved: false } },
    ]);
    const dialog = await openSignupDialog(page);

    await expect(dialog.getByTestId("waitlist-if-full-checkbox")).toBeVisible();
    await dialog.getByTestId("shift-signup-confirm-button").click();

    await expect.poll(() => bodies.length).toBe(1);
    expect(formField(bodies[0], "waitlistIfFull")).toBe("0");
  });

  test("switches to the waitlist view when the shift fills mid-signup", async ({
    page,
  }) => {
    const bodies = await stubSignup(page, [
      {
        status: 400,
        json: {
          error: "Shift is full; waitlist available",
          waitlistAvailable: true,
          confirmedCount: 4,
          capacity: 4,
          waitlistCount: 3,
        },
      },
      {
        status: 200,
        json: { id: "s1", status: "WAITLISTED", autoApproved: false },
      },
    ]);
    const dialog = await openSignupDialog(page);
    await dialog.getByTestId("shift-signup-confirm-button").click();

    // A choice, not an error.
    await expect(dialog.getByTestId("shift-filled-notice")).toBeVisible();
    await expect(dialog.getByTestId("signup-error")).toHaveCount(0);
    await expect(dialog.getByTestId("shift-signup-dialog-title")).toHaveText(
      "Join Waitlist"
    );
    await expect(
      dialog.getByTestId("shift-signup-dialog-description")
    ).toContainText("3 volunteers are on the waitlist.");
    await expect(dialog.getByTestId("shift-details-capacity")).toContainText(
      "4/4 confirmed"
    );
    await expect(dialog.getByTestId("waitlist-process-note")).toBeVisible();
    // The opt-in question no longer applies once they're choosing the list.
    await expect(dialog.getByTestId("waitlist-if-full-checkbox")).toHaveCount(0);

    const joinButton = dialog.getByTestId("shift-signup-confirm-button");
    await expect(joinButton).toHaveText("Join Waitlist");
    await joinButton.click();

    await expect.poll(() => bodies.length).toBe(2);
    expect(formField(bodies[1], "waitlist")).toBe("1");
    await expect(dialog).toBeHidden();
  });
});
