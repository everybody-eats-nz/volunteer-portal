import { test, expect } from "./base";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
  getShiftTypeByName,
  deleteSignupsByShiftIds,
} from "./helpers/test-helpers";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { randomUUID } from "crypto";
import { nowInNZT } from "@/lib/timezone";

/**
 * A date of birth that makes the volunteer exactly `years` old today
 * (their birthday was yesterday, so the age is unambiguous).
 */
function dateOfBirthForAge(years: number): string {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - years);
  dob.setDate(dob.getDate() - 1);
  return dob.toISOString();
}

test.describe.configure({ timeout: 60_000 });
test.describe("Underage guardian requirement", () => {
  let testId: string;
  let volunteerEmail: string;
  let testShiftIds: string[];
  let shiftId: string;

  test.beforeEach(async ({ page }) => {
    testId = randomUUID().slice(0, 8);
    volunteerEmail = `volunteer-guardian-${testId}@example.com`;
    testShiftIds = [];

    await loginAsAdmin(page);

    // 13-year-old volunteer with parental consent already received, so the
    // guardian-name rule is the only underage gate left to satisfy.
    await createTestUser(page, volunteerEmail, "VOLUNTEER", {
      dateOfBirth: dateOfBirthForAge(13),
      requiresParentalConsent: true,
      parentalConsentReceived: true,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0);

    const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
    const shift = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      capacity: 4,
      shiftTypeId: shiftType?.id,
      notes: "Guardian requirement test shift",
    });
    shiftId = shift.id;
    testShiftIds.push(shiftId);
  });

  test.afterEach(async ({ page }) => {
    await loginAsAdmin(page);
    await deleteSignupsByShiftIds(page, testShiftIds);
    await deleteTestUsers(page, [volunteerEmail]);
    await deleteTestShifts(page, testShiftIds);
  });

  async function openSignupDialog(page: import("@playwright/test").Page) {
    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/shifts/details?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // .first() avoids strict-mode violation: shift cards render twice (mobile + desktop)
    const shiftCard = page
      .locator(`[data-testid="shift-card-${shiftId}"]`)
      .first();
    await expect(shiftCard).toBeVisible({ timeout: 15000 });

    await shiftCard.getByTestId("shift-signup-button").click();
    await expect(page.getByTestId("shift-signup-dialog")).toBeVisible();
  }

  test("signup dialog requires a guardian name for volunteers 14 and under", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);
    await openSignupDialog(page);

    // The guardian field appears once the profile (age) check resolves
    const guardianInput = page.getByTestId("shift-signup-guardian");
    await expect(guardianInput).toBeVisible({ timeout: 10000 });

    // Submitting without a guardian name is blocked client-side
    await page.getByTestId("shift-signup-confirm-button").click();
    await expect(page.getByTestId("signup-error")).toContainText(
      "Please provide your guardian's name"
    );

    // Filling in the guardian name lets the signup through
    await guardianInput.fill("Jane Smith");
    await page.getByTestId("shift-signup-confirm-button").click();
    await expect(page.getByTestId("shift-signup-dialog")).not.toBeVisible({
      timeout: 15000,
    });
  });

  test("web signup API rejects underage signups without a guardian name", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);

    // No body at all: previously this skipped the guardian check entirely
    const noBody = await page.request.post(`/api/shifts/${shiftId}/signup`);
    expect(noBody.status()).toBe(400);
    expect((await noBody.json()).error).toBe("Guardian name required");

    // A note that doesn't name a guardian is rejected too
    const badNote = await page.request.post(`/api/shifts/${shiftId}/signup`, {
      form: { note: "Excited for my first shift" },
    });
    expect(badNote.status()).toBe(400);
    expect((await badNote.json()).error).toBe("Guardian name required");

    // Naming a guardian in the note succeeds
    const withGuardian = await page.request.post(
      `/api/shifts/${shiftId}/signup`,
      { form: { note: "Guardian: Jane Smith" } }
    );
    expect(withGuardian.ok()).toBeTruthy();
  });

  test("mobile signup API rejects underage signups without a guardian name", async ({
    page,
  }) => {
    const loginResponse = await page.request.post("/api/auth/mobile/login", {
      data: { email: volunteerEmail, password: "Test123456" },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { token } = await loginResponse.json();
    const authHeaders = { Authorization: `Bearer ${token}` };

    // No note: the mobile route previously had no guardian check at all
    const noNote = await page.request.post(
      `/api/mobile/shifts/${shiftId}/signup`,
      { headers: authHeaders, data: {} }
    );
    expect(noNote.status()).toBe(400);
    expect((await noNote.json()).error).toBe("Guardian name required");

    // A note that doesn't name a guardian is rejected too
    const badNote = await page.request.post(
      `/api/mobile/shifts/${shiftId}/signup`,
      { headers: authHeaders, data: { note: "See you there" } }
    );
    expect(badNote.status()).toBe(400);
    expect((await badNote.json()).error).toBe("Guardian name required");

    // Naming a guardian in the note (the app's format) succeeds
    const withGuardian = await page.request.post(
      `/api/mobile/shifts/${shiftId}/signup`,
      { headers: authHeaders, data: { note: "Guardian: Jane Smith" } }
    );
    expect(withGuardian.ok()).toBeTruthy();
  });

  test("mobile shift detail eligibility flags the guardian requirement", async ({
    page,
  }) => {
    const loginResponse = await page.request.post("/api/auth/mobile/login", {
      data: { email: volunteerEmail, password: "Test123456" },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { token } = await loginResponse.json();

    const detail = await page.request.get(`/api/mobile/shifts/${shiftId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(detail.ok()).toBeTruthy();
    expect((await detail.json()).eligibility.guardianRequired).toBe(true);
  });
});
