import type { Page } from "@playwright/test";
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

/**
 * Locate a shift card scoped to the visible instance.
 *
 * On the admin shifts page the same `shift-card-<id>` testid can briefly
 * appear twice in the DOM during Next.js streaming / motion exit transitions
 * (one copy hidden or animating out). Matching the visible instance keeps the
 * locator deterministic and avoids Playwright strict-mode violations.
 */
function visibleShiftCard(page: Page, shiftId: string) {
  return page
    .locator(`[data-testid="shift-card-${shiftId}"]:visible`)
    .first();
}

test.describe.configure({ timeout: 60_000 });
test.describe("General Volunteer Movement System", () => {
  let testId: string;
  let adminEmail: string;
  let volunteerEmail: string;
  let testEmails: string[];
  let testShiftIds: string[];
  let volunteerUserId: string;
  let sourceShiftId: string;
  let targetShiftId: string;

  test.beforeEach(async ({ page }) => {
    // Generate unique data per test for parallel safety
    testId = randomUUID().slice(0, 8);
    adminEmail = `admin-movement-${testId}@example.com`;
    volunteerEmail = `volunteer-movement-${testId}@example.com`;
    testEmails = [adminEmail, volunteerEmail];
    testShiftIds = [];

    // Authenticate as admin for API calls that require admin access
    await loginAsAdmin(page);

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
    // Authenticate as admin for cleanup API calls
    await loginAsAdmin(page);

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

      // Navigate directly to tomorrow's date in admin shifts
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Find this test's specific source shift card
      const shiftCard = visibleShiftCard(page, sourceShiftId);

      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      // Should see confirmed status
      await expect(shiftCard.getByText("Confirmed")).toBeVisible({
        timeout: 10000,
      });

      // Should see the move button (blue arrow icon)
      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await expect(moveButton).toHaveAttribute(
        "title",
        "Move to different shift"
      );
    });

    /**
     * Regression: moving a volunteer used to be one-way.
     *
     * The target dropdown filtered down to the volunteer's own backup shift
     * preferences, and the shift they came from is never in that list. Once a
     * volunteer with backup preferences had been moved, admins could not move
     * them back - the dropdown came up empty. Backup preferences are now a
     * hint (sorted first, badged), never a restriction.
     */
    test("admin can move a volunteer whose only backup preference is their current shift", async ({
      page,
    }) => {
      // Volunteer sits on the source shift and nominated only that shift as a backup
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: sourceShiftId,
        status: "CONFIRMED",
        backupForShiftIds: [sourceShiftId],
      });

      await loginAsAdmin(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const shiftCard = visibleShiftCard(page, sourceShiftId);
      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await moveButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

      await page.getByRole("combobox").click();

      // The target shift is not a backup preference, but must still be offered
      const targetOption = page.locator(
        `[data-testid="move-target-option-${targetShiftId}"]`
      );
      await expect(targetOption).toBeVisible({ timeout: 10000 });
      await targetOption.click();

      const moveVolunteerButton = page.getByRole("button", {
        name: "Move Volunteer",
      });
      await expect(moveVolunteerButton).toBeEnabled();
      await moveVolunteerButton.click();

      await page.waitForTimeout(3000);

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const movedToCard = visibleShiftCard(page, targetShiftId);
      await expect(movedToCard).toBeVisible({ timeout: 15000 });
      await expect(movedToCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
    });

    /**
     * Regression: a regular volunteer could not be moved at all.
     *
     * Signups created for regular volunteers were given UUIDs rather than the
     * cuids Prisma hands out, and the movement endpoint validated the id shape.
     * Every attempt came back "Invalid input", so admins could not shuffle
     * their weekly regulars between shifts on the night.
     */
    test("admin can move a volunteer whose signup id is not a cuid", async ({
      page,
    }) => {
      const legacySignupId = randomUUID();

      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        id: legacySignupId,
        userId: volunteerUserId,
        shiftId: sourceShiftId,
        status: "CONFIRMED",
      });

      await loginAsAdmin(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const shiftCard = visibleShiftCard(page, sourceShiftId);
      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await moveButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
      await page.getByRole("combobox").click();

      const targetOption = page.locator(
        `[data-testid="move-target-option-${targetShiftId}"]`
      );
      await expect(targetOption).toBeVisible({ timeout: 10000 });
      await targetOption.click();

      await page.getByRole("button", { name: "Move Volunteer" }).click();

      // The dialog closes on success; a rejected move keeps it open and says why
      await expect(page.locator('[data-testid="move-error-notice"]')).toHaveCount(
        0
      );
      await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15000 });

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const movedToCard = visibleShiftCard(page, targetShiftId);
      await expect(movedToCard).toBeVisible({ timeout: 15000 });
      await expect(movedToCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
    });

    /**
     * The dialog has to say why a move didn't happen. A browser alert used to
     * take the message away from the shift and target that explain it, and
     * closed over the admin's selection.
     */
    test("a rejected move explains itself in the dialog and keeps the selection", async ({
      page,
    }) => {
      // Already signed up for both shifts, so the move is refused outright
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: sourceShiftId,
        status: "CONFIRMED",
      });
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: targetShiftId,
        status: "CONFIRMED",
      });

      await loginAsAdmin(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const shiftCard = visibleShiftCard(page, sourceShiftId);
      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await moveButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });

      await page.getByRole("combobox").click();
      const targetOption = page.locator(
        `[data-testid="move-target-option-${targetShiftId}"]`
      );
      await expect(targetOption).toBeVisible({ timeout: 10000 });
      await targetOption.click();

      const notesField = page.getByPlaceholder(
        "Add any notes about this movement..."
      );
      await notesField.fill("Swapping onto FOH");

      await page.getByRole("button", { name: "Move Volunteer" }).click();

      // The reason lands in the dialog, not in a browser alert
      const errorNotice = page.locator('[data-testid="move-error-notice"]');
      await expect(errorNotice).toBeVisible({ timeout: 15000 });
      await expect(errorNotice).toContainText("already signed up");

      // ...and the admin's selection and notes survive for a retry
      await expect(dialog).toBeVisible();
      await expect(notesField).toHaveValue("Swapping onto FOH");
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

      // Navigate to tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Find and click the move button on this test's source shift card
      const shiftCard = visibleShiftCard(page, sourceShiftId);

      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await expect(moveButton).toBeEnabled();
      await moveButton.click();

      // Dialog should open
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Currently on")).toBeVisible();

      // Open the target-shift dropdown
      const dropdown = page.getByRole("combobox");
      await dropdown.click();

      // Pick this test's specific target shift via testid (parallel-safe)
      const targetOption = page.locator(
        `[data-testid="move-target-option-${targetShiftId}"]`
      );
      await expect(targetOption).toBeVisible({ timeout: 10000 });
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

      // Verify via UI that volunteer now appears in this test's target shift
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const fohShiftCard = visibleShiftCard(page, targetShiftId);

      await expect(fohShiftCard).toBeVisible({ timeout: 15000 });
      await expect(fohShiftCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
    });

    test("admin can move volunteer into a full shift", async ({ page }) => {
      // Ensure volunteer is on source shift
      await deleteSignupsByShiftIds(page, [sourceShiftId, targetShiftId]);
      await createSignup(page, {
        userId: volunteerUserId,
        shiftId: sourceShiftId,
        status: "CONFIRMED",
      });

      // Fill the target shift (capacity 2) so it has no spots left
      const fillerEmails = [
        `filler-a-movement-${testId}@example.com`,
        `filler-b-movement-${testId}@example.com`,
      ];
      testEmails.push(...fillerEmails);
      for (const [index, fillerEmail] of fillerEmails.entries()) {
        await createTestUser(page, fillerEmail, "VOLUNTEER", {
          firstName: "Filler",
          lastName: `Volunteer${index}`,
        });
        const filler = await getUserByEmail(page, fillerEmail);
        await createSignup(page, {
          userId: filler!.id,
          shiftId: targetShiftId,
          status: "CONFIRMED",
        });
      }

      await loginAsAdmin(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const shiftCard = visibleShiftCard(page, sourceShiftId);
      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      const moveButton = shiftCard.locator(
        'button[title="Move to different shift"]'
      );
      await expect(moveButton).toBeVisible({ timeout: 10000 });
      await moveButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
      await page.getByRole("combobox").click();

      // The full shift is still offered, flagged rather than hidden
      const fullOption = page.locator(
        `[data-testid="move-target-option-${targetShiftId}"]`
      );
      await expect(fullOption).toBeVisible({ timeout: 10000 });
      await expect(fullOption).toContainText("Full");
      await expect(fullOption).toContainText("No spots left");
      await fullOption.click();

      // Picking it warns that the move takes the shift over capacity
      await expect(page.getByTestId("move-over-capacity-notice")).toBeVisible();

      const moveVolunteerButton = page.getByRole("button", {
        name: "Move Volunteer",
      });
      await expect(moveVolunteerButton).toBeEnabled();
      await moveVolunteerButton.click();

      await page.waitForTimeout(3000);

      // The move goes through and the shift is now over capacity
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      const movedToCard = visibleShiftCard(page, targetShiftId);
      await expect(movedToCard).toBeVisible({ timeout: 15000 });
      await expect(movedToCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
      await expect(movedToCard.getByText("3/2")).toBeVisible({
        timeout: 10000,
      });
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

      // Navigate to tomorrow's date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Find this test's specific target shift card
      const fohShiftCard = visibleShiftCard(page, targetShiftId);

      await expect(fohShiftCard).toBeVisible({ timeout: 15000 });
      await expect(fohShiftCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
      await expect(fohShiftCard.getByText("Confirmed")).toBeVisible({
        timeout: 10000,
      });

      // This test's source shift should no longer have the volunteer
      const originalShiftCard = visibleShiftCard(page, sourceShiftId);

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

      // Navigate to the month containing tomorrow's shift (handles month boundaries
      // like April 30 → May 1, where the default current-month view would hide it).
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const shiftMonthMs = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        1
      ).getTime();
      await page.goto(`/shifts/mine?month=${shiftMonthMs}`);
      await page.waitForLoadState("load");

      // Should see the new shift (My Shifts is volunteer-scoped, so text match is safe)
      await expect(
        page.getByText("FOH Set-Up & Service").first()
      ).toBeVisible({ timeout: 15000 });
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
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(
        tomorrow.getMonth() + 1
      ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Verify volunteer is in this test's specific target shift
      const fohShiftCard = visibleShiftCard(page, targetShiftId);

      await expect(fohShiftCard).toBeVisible({ timeout: 15000 });
      await expect(fohShiftCard.getByText("Test User")).toBeVisible({
        timeout: 10000,
      });
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
