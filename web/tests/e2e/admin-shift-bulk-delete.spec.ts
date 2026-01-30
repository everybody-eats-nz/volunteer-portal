import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

/**
 * Tests for the admin bulk shift delete functionality.
 *
 * These tests cover:
 * - Delete all shifts button visibility
 * - Delete all shifts dialog display
 * - Bulk delete functionality
 * - Success messages and redirects
 * - Proper authorization
 */
test.describe("Admin Bulk Shift Delete", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-bulk-delete-test-${testId}@example.com`,
    `volunteer-bulk-delete-test-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await createTestUser(page, testEmails[0], "ADMIN");
    await createTestUser(page, testEmails[1], "VOLUNTEER");
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    await deleteTestUsers(page, testEmails);
    await deleteTestShifts(page, testShiftIds);
  });

  // Helper function to get a unique test date (60 days in the future to avoid seeded data)
  function getUniqueTestDate(): string {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 60);
    // Make sure it's a Sunday for restaurant operating days
    const dayOfWeek = testDate.getDay();
    if (dayOfWeek !== 0) {
      testDate.setDate(testDate.getDate() + (7 - dayOfWeek));
    }
    return testDate.toISOString().split("T")[0];
  }

  test.describe.serial("Delete All Functionality", () => {
    let operatingDateStr: string;

    test.beforeEach(async ({ page }) => {
      operatingDateStr = getUniqueTestDate();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      // Create test shifts
      const shift1 = await createShift(page, {
        location: "Wellington",
        start: new Date(operatingDate.setHours(10, 0)),
        end: new Date(operatingDate.setHours(14, 0)),
        capacity: 4,
      });
      testShiftIds.push(shift1.id);

      const operatingDate2 = new Date(operatingDateStr + "T00:00:00");
      const shift2 = await createShift(page, {
        location: "Wellington",
        start: new Date(operatingDate2.setHours(17, 0)),
        end: new Date(operatingDate2.setHours(21, 0)),
        capacity: 6,
      });
      testShiftIds.push(shift2.id);
    });

    test("should show delete all button and dialog when shifts exist", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Delete all button should be visible
      const deleteAllButton = page.getByTestId("delete-all-shifts-button").first();
      await expect(deleteAllButton).toBeVisible({ timeout: 10000 });
      await expect(deleteAllButton).toContainText("Delete All");

      // Click delete all button
      await deleteAllButton.click();

      // Dialog should appear with correct content
      await expect(
        page.getByTestId("delete-all-shifts-dialog")
      ).toBeVisible({ timeout: 5000 });
      await expect(
        page.getByTestId("delete-all-shifts-dialog-title")
      ).toContainText("Delete All Shifts");
      await expect(page.getByText(/\d+ shifts? will be deleted/)).toBeVisible();

      // Close dialog
      const cancelButton = page.getByTestId("delete-all-shifts-cancel-button");
      await cancelButton.click();
      await expect(
        page.getByTestId("delete-all-shifts-dialog")
      ).not.toBeVisible();
    });

    test("should delete all shifts and show success message", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Click delete all button
      const deleteAllButton = page.getByTestId("delete-all-shifts-button").first();
      await expect(deleteAllButton).toBeVisible({ timeout: 10000 });
      await deleteAllButton.click();

      // Wait for dialog and confirm
      await expect(
        page.getByTestId("delete-all-shifts-dialog")
      ).toBeVisible({ timeout: 5000 });
      const confirmButton = page.getByTestId(
        "delete-all-shifts-confirm-button"
      );
      await confirmButton.click();

      // Wait for redirect with success message
      await page.waitForURL(/bulkDeleted=/, { timeout: 15000 });

      // Success message should be visible
      const successMessage = page.getByTestId("shifts-bulk-deleted-message").first();
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText(/\d+ shifts? deleted successfully/);

      // URL should preserve date and location
      expect(page.url()).toContain(`date=${operatingDateStr}`);
      expect(page.url()).toContain("location=Wellington");

      // Clear the test shift IDs since they've been deleted
      testShiftIds.length = 0;
    });
  });

  test.describe("Authorization", () => {
    test("should return 403 when volunteer tries to bulk delete shifts via API", async ({
      page,
    }) => {
      await loginAsVolunteer(page);

      const operatingDateStr = getUniqueTestDate();

      // Try to access the bulk delete API directly
      const response = await page.request.delete(
        `/api/admin/shifts/by-date?date=${operatingDateStr}&location=Wellington`
      );

      expect(response.status()).toBe(403);
    });
  });
});
