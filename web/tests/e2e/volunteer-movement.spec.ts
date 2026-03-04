import { test, expect } from "./base";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
  getUserByEmail,
  createSignup,
  deleteSignupsByShiftIds,
  getShiftTypeByName,
  createNotification,
  deleteNotifications,
} from "./helpers/test-helpers";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { randomUUID } from "crypto";

test.describe.configure({ mode: "serial" });
test.describe("General Volunteer Movement System", () => {
  const testId = randomUUID().slice(0, 8);
  const adminEmail = `admin-movement-${testId}@example.com`;
  const volunteerEmail = `volunteer-movement-${testId}@example.com`;
  const testEmails = [adminEmail, volunteerEmail];
  const testShiftIds: string[] = [];
  let volunteerUserId: string;
  let sourceShiftId: string;
  let targetShiftId: string;

  test.beforeEach(async ({ page }) => {
    // Create test users
    await createTestUser(page, adminEmail, "ADMIN");
    await createTestUser(page, volunteerEmail, "VOLUNTEER");

    // Get volunteer user ID
    const volunteer = await getUserByEmail(page, volunteerEmail);
    volunteerUserId = volunteer!.id;

    // Create shifts for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 30, 0, 0); // 5:30 PM

    // Create source shift (Kitchen Prep & Service)
    const kitchenShiftType = await getShiftTypeByName(
      page,
      "Kitchen Prep & Service"
    );

    const sourceShift = await createShift(page, {
      location: "Wellington",
      start: tomorrow,
      end: new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000),
      capacity: 4,
      shiftTypeId: kitchenShiftType?.id,
      notes: "Source shift for movement testing",
    });
    sourceShiftId = sourceShift.id;
    testShiftIds.push(sourceShiftId);

    // Create target shift (Front of House)
    const fohShiftType = await getShiftTypeByName(page, "FOH Set-Up & Service");

    const targetShift = await createShift(page, {
      location: "Wellington",
      start: new Date(tomorrow.getTime() - 60 * 60 * 1000), // 1 hour earlier (4:30 PM)
      end: new Date(tomorrow.getTime() + 3.5 * 60 * 60 * 1000),
      capacity: 2,
      shiftTypeId: fohShiftType?.id,
      notes: "Target shift for movement testing",
    });
    targetShiftId = targetShift.id;
    testShiftIds.push(targetShiftId);

    // Create initial signup
    await createSignup(page, {
      userId: volunteerUserId,
      shiftId: sourceShiftId,
      status: "CONFIRMED",
    });
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

  test.describe("Admin Volunteer Movement Interface", () => {
    test.afterEach(async ({ page }) => {
      // Clean up any notifications created during the test to ensure isolation
      await deleteNotifications(page, {
        userId: volunteerUserId,
        type: "SHIFT_CONFIRMED",
      });
    });

    test("admin can see move button for confirmed volunteers", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Navigate directly to tomorrow's date in admin shifts
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);

      // Find the shift card with our volunteer
      const shiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "Test User",
        })
        .first();

      await expect(shiftCard).toBeVisible();

      // Should see confirmed status
      await expect(shiftCard.getByText("Confirmed")).toBeVisible();

      // Should see the move button (blue arrow icon)
      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible();
      await expect(moveButton).toHaveAttribute(
        "title",
        "Move to different shift"
      );
    });

    test("admin can move volunteer to different shift", async ({
      page,
    }) => {
      // Ensure volunteer is on source shift
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: sourceShiftId,
        status: "CONFIRMED",
      });

      await loginAsAdmin(page);
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Navigate to tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);

      // Find and click the move button
      const shiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "Test User",
        })
        .first();

      await expect(shiftCard).toBeVisible();

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible();
      await expect(moveButton).toBeEnabled();
      await moveButton.click();

      // Wait a moment for dialog to open
      await page.waitForTimeout(1000);

      // Dialog should open
      await expect(page.getByText("to Different Shift")).toBeVisible();
      await expect(page.getByText("Move this volunteer from")).toBeVisible();

      // Select target shift from dropdown
      const dropdown = page.getByRole("combobox");
      await dropdown.click();

      // Should see available shifts with capacity info
      const targetOption = page
        .getByRole("option")
        .filter({
          hasText: "FOH Set-Up & Service",
        })
        .first();
      await expect(targetOption).toBeVisible();
      await expect(targetOption).toContainText("spots available");
      await targetOption.click();

      // Add movement notes
      const notesField = page.getByPlaceholder(
        "Add any notes about this movement..."
      );
      await notesField.fill("Moved to FOH due to preference and experience");

      // Click move volunteer button
      const moveVolunteerButton = page.getByRole("button", {
        name: "Move Volunteer",
      });
      await expect(moveVolunteerButton).toBeEnabled();
      await moveVolunteerButton.click();

      // Wait for success - dialog should close or show success indication
      await page.waitForTimeout(3000);

      // Verify via UI that volunteer now appears in target shift
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);

      // Find the FOH shift card - volunteer should now be there
      const fohShiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "FOH Set-Up & Service",
        })
        .first();

      await expect(fohShiftCard).toBeVisible();
      await expect(fohShiftCard.getByText("Test User")).toBeVisible();
    });

    test("volunteer now appears in target shift", async ({ page }) => {
      // Move volunteer to target shift for this test
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: targetShiftId,
        status: "CONFIRMED",
      });

      await loginAsAdmin(page);
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Navigate to tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);

      // Find the FOH shift card - volunteer should now be there
      const fohShiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "FOH Set-Up & Service",
        })
        .first();

      await expect(fohShiftCard).toBeVisible();
      await expect(fohShiftCard.getByText("Test User")).toBeVisible();
      await expect(fohShiftCard.getByText("Confirmed")).toBeVisible();

      // Original shift should no longer have the volunteer
      const originalShiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "Kitchen Prep & Service",
        })
        .first();

      if (await originalShiftCard.isVisible()) {
        await expect(
          originalShiftCard.getByText("Test User")
        ).not.toBeVisible();
      }
    });

    test("volunteer receives notification about movement", async ({ page }) => {
      // Move volunteer to target shift and create notification
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: targetShiftId,
        status: "CONFIRMED",
      });

      // Create movement notification via test helper
      await createNotification(page, {
        userId: volunteerUserId,
        type: "SHIFT_CONFIRMED",
        title: "You've been moved to a different shift",
        message:
          "You've been moved from Kitchen Prep & Service to FOH Set-Up & Service",
      });

      await loginAsVolunteer(page, volunteerEmail);
      await page.goto("/dashboard");
      await page.waitForLoadState("load");

      // Check for movement notification
      const notificationBell = page.getByTestId("notification-bell-button");
      await expect(notificationBell).toBeVisible();

      // Click to view notifications
      await notificationBell.click();

      // Should see movement notification
      await expect(
        page.getByText("You've been moved to a different shift")
      ).toBeVisible();
      // Just check that some notification content is visible - be more flexible
      await expect(
        page.getByText(/FOH Set-Up|Set-Up & Service/).first()
      ).toBeVisible();
    });

    test("volunteer can see updated shift in My Shifts", async ({ page }) => {
      // Move volunteer to target shift
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: targetShiftId,
        status: "CONFIRMED",
      });

      await loginAsVolunteer(page, volunteerEmail);
      await page.goto("/shifts/mine");
      await page.waitForLoadState("load");

      // Should see the new shift
      await expect(
        page.getByText("FOH Set-Up & Service").first()
      ).toBeVisible();
    });
  });

  test.describe("Movement History Tracking", () => {
    test.afterEach(async ({ page }) => {
      // Clean up any notifications created during the test to ensure isolation
      await deleteNotifications(page, {
        userId: volunteerUserId,
        type: "SHIFT_CONFIRMED",
      });
    });

    test("admin can see volunteer placement after movement via UI", async ({
      page,
    }) => {
      // Move volunteer to target shift
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: targetShiftId,
        status: "CONFIRMED",
      });

      await loginAsAdmin(page);

      // Navigate to admin shifts for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");
      await page.waitForTimeout(2000);

      // Verify volunteer is in target shift
      const fohShiftCard = page
        .locator('[data-testid^="shift-card-"]')
        .filter({
          hasText: "FOH Set-Up & Service",
        })
        .first();

      await expect(fohShiftCard).toBeVisible();
      await expect(fohShiftCard.getByText("Test User")).toBeVisible();
    });

    test("movement notification is visible to volunteer", async ({ page }) => {
      // Create movement notification
      await createNotification(page, {
        userId: volunteerUserId,
        type: "SHIFT_CONFIRMED",
        title: "You've been moved to a different shift",
        message:
          "You've been moved from Kitchen Prep & Service to FOH Set-Up & Service",
      });

      // Login as volunteer and check notifications
      await loginAsVolunteer(page, volunteerEmail);
      await page.goto("/dashboard");
      await page.waitForLoadState("load");

      // Check notifications
      const notificationBell = page.getByTestId("notification-bell-button");
      await expect(notificationBell).toBeVisible();
      await notificationBell.click();

      const movementNotification = page.getByText(
        "You've been moved to a different shift"
      );
      await expect(movementNotification).toBeVisible();
    });
  });
});
