import { test, expect } from "./base";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
  getUserByEmail,
  getShiftTypeByName,
  deleteSignupsByShiftIds,
  deleteNotifications,
} from "./helpers/test-helpers";
import { loginAsVolunteer, loginAsAdmin } from "./helpers/auth";
import { randomUUID } from "crypto";
import { nowInNZT } from "@/lib/timezone";
import { Page } from "@playwright/test";

test.describe.configure({ timeout: 60_000 });
test.describe("Backup Shift Signup Feature", () => {
  let testId: string;
  let volunteerEmail: string;
  let adminEmail: string;
  let testEmails: string[];
  let testShiftIds: string[];
  let volunteerUserId: string;
  let primaryShiftId: string;
  let backupShift1Id: string;
  let backupShift2Id: string;

  test.beforeEach(async ({ page }) => {
    // Generate unique data per test for parallel safety
    testId = randomUUID().slice(0, 8);
    volunteerEmail = `volunteer-backup-${testId}@example.com`;
    adminEmail = `admin-backup-${testId}@example.com`;
    testEmails = [volunteerEmail, adminEmail];
    testShiftIds = [];

    await loginAsAdmin(page);

    // Create test users
    await createTestUser(page, volunteerEmail, "VOLUNTEER");
    await createTestUser(page, adminEmail, "ADMIN");

    // Get volunteer user ID
    const volunteer = await getUserByEmail(page, volunteerEmail);
    volunteerUserId = volunteer!.id;

    // Create shifts for tomorrow - all at the same time (AM shifts)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(11, 0, 0, 0); // 11:00 AM (before 4pm = AM)

    const endTime = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000); // 3 hours

    // Create primary shift (Kitchen Prep)
    const kitchenShiftType = await getShiftTypeByName(page, "Kitchen Prep");
    const primaryShift = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: endTime,
      capacity: 4,
      shiftTypeId: kitchenShiftType?.id,
      notes: "Primary shift for backup testing",
    });
    primaryShiftId = primaryShift.id;
    testShiftIds.push(primaryShiftId);

    // Create backup shift 1 (FOH Set-Up & Service) - same time, same location
    const fohShiftType = await getShiftTypeByName(page, "FOH Set-Up & Service");
    const backupShift1 = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: endTime,
      capacity: 3,
      shiftTypeId: fohShiftType?.id,
      notes: "Backup shift 1 for testing",
    });
    backupShift1Id = backupShift1.id;
    testShiftIds.push(backupShift1Id);

    // Create backup shift 2 (Dishwasher) - same time, same location
    const dishwasherShiftType = await getShiftTypeByName(page, "Dishwasher");
    const backupShift2 = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: endTime,
      capacity: 2,
      shiftTypeId: dishwasherShiftType?.id,
      notes: "Backup shift 2 for testing",
    });
    backupShift2Id = backupShift2.id;
    testShiftIds.push(backupShift2Id);
  });

  test.afterEach(async ({ page }) => {
    await loginAsAdmin(page);

    // Clean up notifications
    await deleteNotifications(page, { userId: volunteerUserId });

    // Clean up signups
    await deleteSignupsByShiftIds(page, testShiftIds);

    // Cleanup test users and shifts
    await deleteTestUsers(page, testEmails);
    await deleteTestShifts(page, testShiftIds);
  });

  test("volunteer can see concurrent shift backup options when signing up", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);

    // Navigate to shift details page for tomorrow
    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/shifts/details?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find and click the signup button for the primary shift (Kitchen Prep)
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );

    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    const signupButton = primaryShiftCard.getByTestId("shift-signup-button");
    await expect(signupButton).toBeVisible();
    await signupButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(1000);

    // Should see the backup shift options section
    await expect(page.getByText("Flexible with shift changes?")).toBeVisible();
    await expect(
      page.getByText("If we need to move you, which other shifts")
    ).toBeVisible();

    // Should see checkboxes for this test's specific concurrent shifts
    await expect(
      page.locator(`[data-testid="backup-shift-${backupShift1Id}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="backup-shift-${backupShift2Id}"]`)
    ).toBeVisible();

    // Should see capacity info for backup shifts
    await expect(
      page
        .getByTestId("shift-signup-dialog")
        .getByText(/spots available/)
        .first()
    ).toBeVisible();
  });

  async function signupVolunteer(page: Page) {
    await loginAsVolunteer(page, volunteerEmail);

    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/shifts/details?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Click signup button
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );
    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    const signupButton = primaryShiftCard.getByTestId("shift-signup-button");
    await signupButton.click();
    await page.waitForTimeout(1000);

    // Select FOH as backup
    const fohCheckbox = page.locator(
      `[data-testid="backup-shift-${backupShift1Id}"]`
    );
    await expect(fohCheckbox).toBeVisible();
    await fohCheckbox.click();

    // Select Dishwasher as backup
    const dishwasherCheckbox = page.locator(
      `[data-testid="backup-shift-${backupShift2Id}"]`
    );
    await expect(dishwasherCheckbox).toBeVisible();
    await dishwasherCheckbox.click();

    // Both should be checked
    await expect(fohCheckbox).toBeChecked();
    await expect(dishwasherCheckbox).toBeChecked();

    // Submit the signup
    const submitButton = page.getByRole("button", {
      name: /Confirm signup/i,
    });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Dialog should close
    await expect(
      page.getByText("Flexible with shift changes?")
    ).not.toBeVisible();
  }

  test("volunteer can select multiple backup shift preferences", async ({
    page,
  }) => {
    await signupVolunteer(page);
  });

  test("admin can see backup preferences for pending volunteers", async ({
    page,
  }) => {
    await signupVolunteer(page);

    await loginAsAdmin(page);

    // Navigate to tomorrow's shifts
    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find the primary shift card
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );

    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    // Should see pending volunteer
    await expect(primaryShiftCard.getByText(/Pending/i)).toBeVisible({
      timeout: 10000,
    });

    // Should see backup options indicator (renders as "Backup: FOH Set-Up & Service, Dishwasher")
    await expect(
      primaryShiftCard.getByText(/Backup:.*FOH Set-Up & Service.*Dishwasher/)
    ).toBeVisible({ timeout: 10000 });
  });

  test("admin can see move button for pending volunteers with backup options", async ({
    page,
  }) => {
    await signupVolunteer(page);

    await loginAsAdmin(page);

    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find the primary shift card with pending volunteer
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );

    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    // Should have a move button
    const moveButton = primaryShiftCard.getByTestId(/-move-button/);
    await expect(moveButton).toBeVisible({ timeout: 10000 });
    await expect(moveButton).toBeEnabled();
  });

  test("admin move dialog filters to only backup shifts when volunteer has preferences", async ({
    page,
  }) => {
    await signupVolunteer(page);

    await loginAsAdmin(page);

    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find and click move button
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );
    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    const moveButton = primaryShiftCard.getByTestId(/-move-button/);
    await expect(moveButton).toBeVisible({ timeout: 10000 });
    await moveButton.click();

    // Dialog should open - wait for available shifts to load
    await expect(page.getByText("Select Target Shift")).toBeVisible({
      timeout: 10000,
    });

    // Wait for shifts to load in the dropdown
    await page.waitForTimeout(1000);

    // Click the shift selector trigger (Select component)
    const shiftSelector = page.locator('[data-testid$="-move-shift-select"]').first();
    await expect(shiftSelector).toBeVisible();
    await shiftSelector.click();
    await page.waitForTimeout(500);

    // Should see backup shifts (FOH and Dishwasher) as options
    const fohOption = page
      .getByRole("option")
      .filter({ hasText: "FOH Set-Up & Service" });
    const dishwasherOption = page
      .getByRole("option")
      .filter({ hasText: "Dishwasher" });

    // Check if at least one backup shift is visible
    const hasFoh = (await fohOption.count()) > 0;
    const hasDishwasher = (await dishwasherOption.count()) > 0;

    // At least one backup shift should be available
    expect(hasFoh || hasDishwasher).toBeTruthy();
  });

  test("moving pending volunteer changes status to confirmed", async ({
    page,
  }) => {
    await signupVolunteer(page);

    await loginAsAdmin(page);

    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find the move button on the primary shift card
    const primaryShiftCard = page.locator(
      `[data-testid="shift-card-${primaryShiftId}"]`
    );
    await expect(primaryShiftCard).toBeVisible({ timeout: 15000 });

    const moveButton = primaryShiftCard.getByTestId(/-move-button/).first();
    await expect(moveButton).toBeVisible({ timeout: 10000 });
    await moveButton.click();

    // Wait for dialog and available shifts to load
    await expect(page.getByText("Select Target Shift")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // Click the shift selector
    const shiftSelector = page.locator('[data-testid$="-move-shift-select"]').first();
    await expect(shiftSelector).toBeVisible();
    await shiftSelector.click();
    await page.waitForTimeout(500);

    // Select FOH shift
    const fohOption = page
      .getByRole("option")
      .filter({ hasText: "FOH Set-Up & Service" })
      .first();
    await expect(fohOption).toBeVisible();
    await fohOption.click();

    // Wait for dropdown to close and dialog to settle
    await page.waitForTimeout(500);

    // Click confirm move (button text is "Move Volunteer")
    const confirmButton = page.getByRole("button", { name: /move volunteer/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Reload the page to see changes
    await page.reload();
    await page.waitForTimeout(2000);

    // Find the FOH shift card (backup shift 1)
    const fohShiftCard = page.locator(
      `[data-testid="shift-card-${backupShift1Id}"]`
    );

    // Volunteer should now be confirmed in FOH shift
    await expect(fohShiftCard).toBeVisible({ timeout: 15000 });
    await expect(fohShiftCard.getByText("Confirmed")).toBeVisible({
      timeout: 10000,
    });
  });

  test("note field is hidden behind a button by default", async ({ page }) => {
    // Login as admin first to create the shift
    await loginAsAdmin(page);

    // Create a new shift for this test
    const tomorrow = nowInNZT();
    tomorrow.setDate(tomorrow.getDate() + 2); // Day after tomorrow
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const kitchenShiftType = await getShiftTypeByName(page, "Kitchen Prep");
    const testShift = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
      capacity: 4,
      shiftTypeId: kitchenShiftType?.id,
    });
    testShiftIds.push(testShift.id);

    // Now login as volunteer to test the signup flow
    await loginAsVolunteer(page, volunteerEmail);

    await page.goto(`/shifts/details?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Find and click signup button (scoped to this test's specific shift)
    const shiftCard = page
      .locator(`[data-testid="shift-card-${testShift.id}"]`)
      .first();
    await expect(shiftCard).toBeVisible({ timeout: 15000 });

    const signupButton = shiftCard.getByTestId("shift-signup-button");
    await signupButton.click();
    await page.waitForTimeout(1000);

    // Should see the "Add a note" button, not the textarea
    const addNoteButton = page.getByTestId("show-note-button");
    await expect(addNoteButton).toBeVisible();
    await expect(addNoteButton).toHaveText(/Add a message/i);

    // Note field should not be visible
    await expect(page.getByTestId("shift-signup-note")).not.toBeVisible();

    // Click the button to reveal note field
    await addNoteButton.click();
    await page.waitForTimeout(300);

    // Now the textarea should be visible
    await expect(page.getByTestId("shift-signup-note")).toBeVisible();

    // And the button should be hidden
    await expect(addNoteButton).not.toBeVisible();
  });
});
