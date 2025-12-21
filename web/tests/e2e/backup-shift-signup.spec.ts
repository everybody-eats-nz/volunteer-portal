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

test.describe.configure({ mode: "serial" });
test.describe("Backup Shift Signup Feature", () => {
  const testId = randomUUID().slice(0, 8);
  const volunteerEmail = `volunteer-backup-${testId}@example.com`;
  const adminEmail = `admin-backup-${testId}@example.com`;
  const testEmails = [volunteerEmail, adminEmail];
  const testShiftIds: string[] = [];
  let volunteerUserId: string;
  let primaryShiftId: string;
  let backupShift1Id: string;
  let backupShift2Id: string;

  test.beforeEach(async ({ page }) => {
    // Reset test shift IDs array
    testShiftIds.length = 0;

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

    // Create primary shift (Kitchen Prep & Service)
    const kitchenShiftType = await getShiftTypeByName(
      page,
      "Kitchen Prep & Service"
    );
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
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(
      `/shifts/details?date=${tomorrowStr}&location=Wellington`
    );
    await page.waitForLoadState("load");

    // Find and click the signup button for the primary shift (Kitchen Prep & Service)
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    await expect(primaryShiftCard).toBeVisible();

    const signupButton = primaryShiftCard.getByTestId("shift-signup-button");
    await expect(signupButton).toBeVisible();
    await signupButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(1000);

    // Should see the backup shift options section
    await expect(
      page.getByText("Flexible with shift changes?")
    ).toBeVisible();
    await expect(
      page.getByText("If we need to move you, which other shifts")
    ).toBeVisible();

    // Should see checkboxes for concurrent shifts
    await expect(page.getByText("FOH Set-Up & Service")).toBeVisible();
    await expect(page.getByText("Dishwasher")).toBeVisible();

    // Should see capacity info for backup shifts
    await expect(page.getByText(/spots available/).first()).toBeVisible();
  });

  test("volunteer can select multiple backup shift preferences", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(
      `/shifts/details?date=${tomorrowStr}&location=Wellington`
    );
    await page.waitForLoadState("load");

    // Click signup button
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    const signupButton = primaryShiftCard.getByTestId("shift-signup-button");
    await signupButton.click();
    await page.waitForTimeout(1000);

    // Select FOH as backup
    const fohCheckbox = page.locator(`[data-testid="backup-shift-${backupShift1Id}"]`);
    await expect(fohCheckbox).toBeVisible();
    await fohCheckbox.click();

    // Select Dishwasher as backup
    const dishwasherCheckbox = page.locator(`[data-testid="backup-shift-${backupShift2Id}"]`);
    await expect(dishwasherCheckbox).toBeVisible();
    await dishwasherCheckbox.click();

    // Both should be checked
    await expect(fohCheckbox).toBeChecked();
    await expect(dishwasherCheckbox).toBeChecked();

    // Submit the signup
    const submitButton = page.getByRole("button", {
      name: /Sign Up|Join/i,
    });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Dialog should close
    await expect(
      page.getByText("Flexible with shift changes?")
    ).not.toBeVisible();
  });

  test("admin can see backup preferences for pending volunteers", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/shifts");
    await page.waitForLoadState("load");

    // Navigate to tomorrow's shifts
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForTimeout(2000);

    // Find the primary shift card
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    await expect(primaryShiftCard).toBeVisible();

    // Should see pending volunteer
    await expect(primaryShiftCard.getByText(/Pending/i)).toBeVisible();

    // Should see backup options indicator
    await expect(primaryShiftCard.getByText("🤝 Backup options:")).toBeVisible();
    await expect(primaryShiftCard.getByText("FOH Set-Up & Service")).toBeVisible();
    await expect(primaryShiftCard.getByText("Dishwasher")).toBeVisible();
  });

  test("admin can see move button for pending volunteers with backup options", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForTimeout(2000);

    // Find the primary shift card with pending volunteer
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    await expect(primaryShiftCard).toBeVisible();

    // Find the volunteer actions section
    const volunteerSection = primaryShiftCard
      .locator('[data-testid^="pending-volunteer-"]')
      .first();

    // Should have a move button
    const moveButton = volunteerSection.getByRole("button", {
      name: /move/i,
    });
    await expect(moveButton).toBeVisible();
    await expect(moveButton).toBeEnabled();
  });

  test("admin move dialog filters to only backup shifts when volunteer has preferences", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForTimeout(2000);

    // Find and click move button
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    const volunteerSection = primaryShiftCard
      .locator('[data-testid^="pending-volunteer-"]')
      .first();

    const moveButton = volunteerSection.getByRole("button", {
      name: /move/i,
    });
    await moveButton.click();
    await page.waitForTimeout(1000);

    // Dialog should open
    await expect(
      page.getByText(/Move.*to Different Shift/i)
    ).toBeVisible();

    // Click the shift selector
    const shiftSelector = page.getByRole("combobox");
    await shiftSelector.click();
    await page.waitForTimeout(500);

    // Should see only backup shifts (FOH and Dishwasher), not other shifts
    await expect(
      page.getByRole("option").filter({ hasText: "FOH Set-Up & Service" })
    ).toBeVisible();
    await expect(
      page.getByRole("option").filter({ hasText: "Dishwasher" })
    ).toBeVisible();

    // Should show spots available
    await expect(page.getByText(/spots available/)).toBeVisible();
  });

  test("moving pending volunteer changes status to confirmed", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForTimeout(2000);

    // Click move button
    const primaryShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep & Service" })
      .first();

    const volunteerSection = primaryShiftCard
      .locator('[data-testid^="pending-volunteer-"]')
      .first();

    const moveButton = volunteerSection.getByRole("button", {
      name: /move/i,
    });
    await moveButton.click();
    await page.waitForTimeout(1000);

    // Select FOH shift
    const shiftSelector = page.getByRole("combobox");
    await shiftSelector.click();
    await page.waitForTimeout(500);

    const fohOption = page
      .getByRole("option")
      .filter({ hasText: "FOH Set-Up & Service" })
      .first();
    await fohOption.click();

    // Click confirm move
    const confirmButton = page.getByRole("button", {
      name: /Move Volunteer/i,
    });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for success
    await page.waitForTimeout(3000);

    // Reload the page to see changes
    await page.reload();
    await page.waitForTimeout(2000);

    // Find the FOH shift card
    const fohShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "FOH Set-Up & Service" })
      .first();

    // Volunteer should now be confirmed in FOH shift
    await expect(fohShiftCard).toBeVisible();
    await expect(fohShiftCard.getByText("Confirmed")).toBeVisible();
  });

  test("volunteer receives notification when moved from pending to backup shift", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);
    await page.goto("/dashboard");
    await page.waitForLoadState("load");

    // Check notification bell
    const notificationBell = page.getByTestId("notification-bell-button");
    await expect(notificationBell).toBeVisible();

    // Should have unread notification badge
    await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();

    // Click to view notifications
    await notificationBell.click();
    await page.waitForTimeout(500);

    // Should see movement notification
    await expect(
      page.getByText("You've been moved to a different shift")
    ).toBeVisible();
    await expect(page.getByText(/FOH Set-Up & Service/)).toBeVisible();
  });

  test("note field is hidden behind a button by default", async ({ page }) => {
    await loginAsVolunteer(page, volunteerEmail);

    // Create a new shift for this test
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2); // Day after tomorrow
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const kitchenShiftType = await getShiftTypeByName(
      page,
      "Kitchen Prep"
    );
    const testShift = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
      capacity: 4,
      shiftTypeId: kitchenShiftType?.id,
    });
    testShiftIds.push(testShift.id);

    await page.goto(
      `/shifts/details?date=${tomorrowStr}&location=Wellington`
    );
    await page.waitForLoadState("load");

    // Find and click signup button
    const shiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({ hasText: "Kitchen Prep" })
      .first();

    const signupButton = shiftCard.getByTestId("shift-signup-button");
    await signupButton.click();
    await page.waitForTimeout(1000);

    // Should see the "Add a note" button, not the textarea
    const addNoteButton = page.getByTestId("show-note-button");
    await expect(addNoteButton).toBeVisible();
    await expect(addNoteButton).toHaveText(
      /Add a note for the coordinator/i
    );

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
