import { test, expect } from "./base";
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
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import { formatInNZT } from "@/lib/timezone";
import { randomUUID } from "crypto";

/**
 * A waitlist place is only worth holding if you can see how many people are
 * ahead of you — volunteers asked for exactly this number so they could decide
 * whether to keep standing by or free the evening up. These tests pin the
 * count to every surface that shows it.
 */
// One full shift with a waitlist serves all three assertions, so it is built
// once and the tests run in order against it rather than paying for an admin
// login and five API writes per test.
test.describe.configure({ mode: "serial", timeout: 60_000 });

test.describe("Waitlist size visibility", () => {
  const WAITLISTED_TOTAL = 3; // the volunteer plus two others

  const testId = randomUUID().slice(0, 8);
  const volunteerEmail = `waitlist-${testId}@example.com`;
  const otherEmails = [
    `waitlist-confirmed-${testId}@example.com`,
    `waitlist-other1-${testId}@example.com`,
    `waitlist-other2-${testId}@example.com`,
  ];

  let shiftId: string;
  let shiftStart: Date;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);

    for (const email of [volunteerEmail, ...otherEmails]) {
      await createTestUser(page, email, "VOLUNTEER");
    }

    // Tomorrow evening, capacity 1 — one confirmed volunteer fills it, so
    // everyone else can only be waitlisted.
    shiftStart = new Date();
    shiftStart.setDate(shiftStart.getDate() + 1);
    shiftStart.setHours(17, 30, 0, 0);

    const shiftType = await getShiftTypeByName(page, "Dishwasher");
    const shift = await createShift(page, {
      location: "Wellington",
      start: shiftStart,
      capacity: 1,
      shiftTypeId: shiftType?.id,
      notes: `Waitlist visibility ${testId}`,
    });
    shiftId = shift.id;

    const [confirmedEmail, ...waitlistedEmails] = otherEmails;
    const confirmed = await getUserByEmail(page, confirmedEmail);
    await createSignup(page, {
      userId: confirmed!.id,
      shiftId,
      status: "CONFIRMED",
    });

    for (const email of [volunteerEmail, ...waitlistedEmails]) {
      const user = await getUserByEmail(page, email);
      await createSignup(page, {
        userId: user!.id,
        shiftId,
        status: "WAITLISTED",
      });
    }

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await deleteSignupsByShiftIds(page, [shiftId]);
    await deleteTestShifts(page, [shiftId]);
    await deleteTestUsers(page, [volunteerEmail, ...otherEmails]);
    await page.close();
  });

  test("shows the waitlist size on the shift detail page", async ({ page }) => {
    await loginAsVolunteer(page, volunteerEmail);
    await gotoSettled(page, `/shifts/${shiftId}`);

    await expect(page.getByTestId("shift-waitlist-count").first()).toHaveText(
      `${WAITLISTED_TOTAL} on the waitlist`
    );

    // A waitlist place is not a spot on the shift, so the page says so rather
    // than showing the "you're signed up" confirmation.
    const standing = page.getByTestId("your-waitlist-standing").first();
    await expect(standing).toContainText("You're on the waitlist");
    await expect(standing).toContainText("if a confirmed volunteer cancels");

    // Leaving is the other half of the decision, so the action has to be
    // reachable and worded as leaving a waitlist, not cancelling a shift.
    const leaveButton = page.getByTestId("cancel-shift-button").first();
    await expect(leaveButton).toHaveText(/Leave Waitlist/);

    await leaveButton.click();
    const confirmDialog = page.getByTestId("cancel-shift-dialog").first();
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText("Leave the waitlist for");
    await expect(
      page.getByTestId("keep-signup-button").first()
    ).toHaveText("Stay on the waitlist");
  });

  test("shows the waitlist size on the day's shift card", async ({ page }) => {
    await loginAsVolunteer(page, volunteerEmail);
    const date = formatInNZT(shiftStart, "yyyy-MM-dd");
    await gotoSettled(
      page,
      `/shifts/details?date=${date}&location=Wellington`
    );

    await expect(
      page.getByTestId(`shift-card-waitlist-${shiftId}`).first()
    ).toContainText(`${WAITLISTED_TOTAL} waiting`);
  });

  test("shows the waitlist size against the volunteer's own signup", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);

    // Pin the month to the shift's own month so the row is on screen even when
    // "tomorrow" falls into the next month.
    const monthStart = new Date(
      shiftStart.getFullYear(),
      shiftStart.getMonth(),
      1
    );
    await gotoSettled(page, `/shifts/mine?month=${monthStart.getTime()}`);

    await expect(page.getByTestId("row-waitlist-count").first()).toHaveText(
      `${WAITLISTED_TOTAL} on the waitlist`
    );
  });
});
