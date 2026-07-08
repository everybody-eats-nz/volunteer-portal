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
    // Clear accumulator so stale IDs don't pile up across tests
    testShiftIds.length = 0;
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
    return `${testDate.getFullYear()}-${String(
      testDate.getMonth() + 1
    ).padStart(2, "0")}-${String(testDate.getDate()).padStart(2, "0")}`;
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

      // Delete menu should be visible; open it and pick "this day"
      const deleteMenuButton = page
        .getByTestId("delete-shifts-menu-button")
        .first();
      await expect(deleteMenuButton).toBeVisible({ timeout: 10000 });
      await expect(deleteMenuButton).toContainText("Delete");
      await deleteMenuButton.click();
      await page.getByTestId("delete-all-shifts-menu-item").click();

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

      // Open the delete menu and pick "this day"
      const deleteMenuButton = page
        .getByTestId("delete-shifts-menu-button")
        .first();
      await expect(deleteMenuButton).toBeVisible({ timeout: 10000 });
      await deleteMenuButton.click();
      await page.getByTestId("delete-all-shifts-menu-item").click();

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

  test.describe.serial("Delete by Date Range", () => {
    // Isolated from the "Delete All" tests (different location and window)
    // so parallel workers can't delete each other's shifts.
    const rangeLocation = "Glen Innes";
    let rangeStartStr: string;
    let rangeEndStr: string;

    // Build a yyyy-MM-dd string for a date offset from a base date string
    function offsetDateStr(baseStr: string, days: number): string {
      const date = new Date(baseStr + "T00:00:00");
      date.setDate(date.getDate() + days);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    }

    // A Sunday ~90 days out, past seeded data and the single-day tests
    function getRangeTestStartDate(): string {
      const testDate = new Date();
      testDate.setDate(testDate.getDate() + 90);
      const dayOfWeek = testDate.getDay();
      if (dayOfWeek !== 0) {
        testDate.setDate(testDate.getDate() + (7 - dayOfWeek));
      }
      return `${testDate.getFullYear()}-${String(
        testDate.getMonth() + 1
      ).padStart(2, "0")}-${String(testDate.getDate()).padStart(2, "0")}`;
    }

    test.beforeEach(async ({ page }) => {
      rangeStartStr = getRangeTestStartDate();
      rangeEndStr = offsetDateStr(rangeStartStr, 6);

      // Create shifts on two different days inside the range
      for (const dayStr of [rangeStartStr, offsetDateStr(rangeStartStr, 3)]) {
        const day = new Date(dayStr + "T00:00:00");
        const shift = await createShift(page, {
          location: rangeLocation,
          start: new Date(day.setHours(10, 0)),
          end: new Date(day.setHours(14, 0)),
          capacity: 4,
        });
        testShiftIds.push(shift.id);
      }
    });

    test("should delete shifts across a date range from the dialog", async ({
      page,
    }) => {
      // Navigate with the range start as the date filter so the range
      // picker opens on the right month
      await page.goto(
        `/admin/shifts?date=${rangeStartStr}&location=${encodeURIComponent(rangeLocation)}`
      );
      await page.waitForLoadState("load");

      const deleteMenuButton = page
        .getByTestId("delete-shifts-menu-button")
        .first();
      await expect(deleteMenuButton).toBeVisible({ timeout: 10000 });
      await deleteMenuButton.click();
      await page.getByTestId("delete-date-range-menu-item").click();

      const dialog = page.getByTestId("delete-date-range-dialog");
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Confirm is disabled until a range is picked
      const confirmButton = page.getByTestId(
        "delete-date-range-confirm-button"
      );
      await expect(confirmButton).toBeDisabled();

      // Open the range picker and select start + end days. Day buttons
      // carry data-day in en-NZ d/MM/yyyy format; :visible skips the
      // hidden duplicates react-day-picker renders for outside days.
      await page.getByTestId("delete-date-range-input").click();
      const toDataDay = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-NZ");
      };
      await page
        .locator(`[data-day="${toDataDay(rangeStartStr)}"]:visible`)
        .first()
        .click();
      await page
        .locator(`[data-day="${toDataDay(rangeEndStr)}"]:visible`)
        .first()
        .click();
      // Close the picker so it doesn't cover the dialog
      await page.keyboard.press("Escape");

      // Preview should report both shifts
      const previewCard = page.getByTestId("delete-date-range-preview");
      await expect(previewCard).toBeVisible();
      await expect(previewCard).toContainText("2 shifts will be deleted", {
        timeout: 10000,
      });

      // Confirm deletion
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      // Redirect with success message, preserving filters
      await page.waitForURL(/bulkDeleted=/, { timeout: 15000 });
      const successMessage = page
        .getByTestId("shifts-bulk-deleted-message")
        .first();
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText(
        /2 shifts deleted successfully/
      );
      const redirectedUrl = new URL(page.url());
      expect(redirectedUrl.searchParams.get("date")).toBe(rangeStartStr);
      expect(redirectedUrl.searchParams.get("location")).toBe(rangeLocation);

      testShiftIds.length = 0;
    });

    test("should validate date range parameters and scope deletes via API", async ({
      page,
    }) => {
      const locationParam = encodeURIComponent(rangeLocation);

      // endDate before startDate
      const backwards = await page.request.delete(
        `/api/admin/shifts/by-date-range?startDate=${rangeEndStr}&endDate=${rangeStartStr}&location=${locationParam}`
      );
      expect(backwards.status()).toBe(400);

      // Range longer than a year
      const tooLong = await page.request.delete(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${offsetDateStr(rangeStartStr, 400)}&location=${locationParam}`
      );
      expect(tooLong.status()).toBe(400);

      // Missing location
      const noLocation = await page.request.delete(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${rangeEndStr}`
      );
      expect(noLocation.status()).toBe(400);

      // Preview endpoint returns counts without deleting
      const preview = await page.request.get(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${rangeEndStr}&location=${locationParam}`
      );
      expect(preview.status()).toBe(200);
      const previewData = await preview.json();
      expect(previewData.shiftCount).toBe(2);

      // Create a shift in another location inside the same window; the
      // range delete must not touch it
      const otherDay = new Date(offsetDateStr(rangeStartStr, 1) + "T00:00:00");
      const otherShift = await createShift(page, {
        location: "Onehunga",
        start: new Date(otherDay.setHours(10, 0)),
        end: new Date(otherDay.setHours(14, 0)),
        capacity: 4,
      });
      testShiftIds.push(otherShift.id);

      const deleteResponse = await page.request.delete(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${rangeEndStr}&location=${locationParam}`
      );
      expect(deleteResponse.status()).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.deletedCount).toBe(2);

      // The other location's shift survives
      const otherLocationPreview = await page.request.get(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${rangeEndStr}&location=Onehunga`
      );
      expect(otherLocationPreview.status()).toBe(200);
      const otherLocationData = await otherLocationPreview.json();
      expect(otherLocationData.shiftCount).toBe(1);

      // Range is now empty
      const afterDelete = await page.request.get(
        `/api/admin/shifts/by-date-range?startDate=${rangeStartStr}&endDate=${rangeEndStr}&location=${locationParam}`
      );
      const afterData = await afterDelete.json();
      expect(afterData.shiftCount).toBe(0);
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

    test("should return 403 when volunteer tries to delete a date range via API", async ({
      page,
    }) => {
      await loginAsVolunteer(page);

      const operatingDateStr = getUniqueTestDate();

      const response = await page.request.delete(
        `/api/admin/shifts/by-date-range?startDate=${operatingDateStr}&endDate=${operatingDateStr}&location=Wellington`
      );

      expect(response.status()).toBe(403);
    });
  });
});
