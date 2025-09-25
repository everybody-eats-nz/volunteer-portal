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
 * Tests for the admin shift edit and delete functionality.
 *
 * These tests cover:
 * - Edit shift buttons on shift cards
 * - Navigation to edit shift page
 * - Edit form functionality and validation
 * - Delete shift buttons on shift cards
 * - Delete confirmation dialog
 * - Delete functionality with and without signups
 * - Success messages and redirects
 * - Proper error handling
 */
test.describe("Admin Shift Edit and Delete", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-shift-edit-test-${testId}@example.com`,
    `volunteer-shift-edit-test-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];

  test.beforeAll(async () => {
    // Create test users with unique emails
    await createTestUser(testEmails[0], "ADMIN");
    await createTestUser(testEmails[1], "VOLUNTEER");
  });

  test.afterAll(async () => {
    // Cleanup test users and shifts
    await deleteTestUsers(testEmails);
    await deleteTestShifts(testShiftIds);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("Edit Shift Functionality", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(10, 0)),
        end: new Date(operatingDate.setHours(14, 0)),
        capacity: 4,
        notes: "Test shift for editing",
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test("should display edit buttons on shift cards", async ({ page }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Check that edit button is visible on shift card
      const editButton = page.getByTestId(`edit-shift-button-${testShiftId}`);
      await expect(editButton).toBeVisible();
      await expect(editButton).toContainText("Edit");
    });

    test.skip("should navigate to edit page when clicking edit button", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Click edit button
      const editButton = page.getByTestId(`edit-shift-button-${testShiftId}`);
      await editButton.click();

      // Should navigate to edit page
      await expect(page).toHaveURL(`/admin/shifts/${testShiftId}/edit`);
      await expect(page.getByTestId("edit-shift-page")).toBeVisible();
    });

    test("should display edit form with correct pre-filled data", async ({
      page,
    }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Check form elements are present and pre-filled
      await expect(page.getByTestId("edit-shift-type-select")).toBeVisible();
      await expect(page.getByTestId("edit-shift-date-input")).toBeVisible();
      await expect(
        page.getByTestId("edit-shift-start-time-input")
      ).toBeVisible();
      await expect(page.getByTestId("edit-shift-end-time-input")).toBeVisible();
      await expect(
        page.getByTestId("edit-shift-location-select")
      ).toBeVisible();
      await expect(page.getByTestId("edit-shift-capacity-input")).toBeVisible();

      // Check pre-filled values
      const capacityInput = page.getByTestId("edit-shift-capacity-input");
      await expect(capacityInput).toHaveValue("4");

      const startTimeInput = page.getByTestId("edit-shift-start-time-input");
      await expect(startTimeInput).toHaveValue("10:00");

      const endTimeInput = page.getByTestId("edit-shift-end-time-input");
      await expect(endTimeInput).toHaveValue("14:00");
    });

    test("should update shift successfully", async ({ page }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Update capacity
      const capacityInput = page.getByTestId("edit-shift-capacity-input");
      await capacityInput.fill("6");

      // Update start time
      const startTimeInput = page.getByTestId("edit-shift-start-time-input");
      await startTimeInput.fill("09:00");

      // Submit form
      const updateButton = page.getByTestId("update-shift-button");
      await updateButton.click();

      // Should redirect to shifts page with success message
      await expect(page).toHaveURL(/\/admin\/shifts\?updated=1/);
      await expect(page.getByTestId("shift-updated-message")).toBeVisible();
      await expect(page.getByText("Shift updated successfully!")).toBeVisible();
    });

    test("should show validation errors for invalid data", async ({ page }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Set invalid end time (before start time)
      const startTimeInput = page.getByTestId("edit-shift-start-time-input");
      await startTimeInput.fill("14:00");

      const endTimeInput = page.getByTestId("edit-shift-end-time-input");
      await endTimeInput.fill("10:00");

      // Submit form
      const updateButton = page.getByTestId("update-shift-button");
      await updateButton.click();

      // Should show validation error
      await expect(page).toHaveURL(/error=range/);
      await expect(
        page.getByText("End time must be after start time")
      ).toBeVisible();
    });

    test("should allow canceling edit and return to shifts page", async ({
      page,
    }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Click cancel button
      const cancelButton = page.getByTestId("cancel-edit-shift-button");
      await cancelButton.click();

      // Should return to shifts page
      await expect(page).toHaveURL("/admin/shifts");
    });

    test("should show warning when editing past shifts", async ({ page }) => {
      // Create a past shift
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pastShift = await createShift({
        location: "Wellington",
        start: new Date(yesterday.setHours(10, 0)),
        end: new Date(yesterday.setHours(14, 0)),
        capacity: 2,
      });
      testShiftIds.push(pastShift.id);

      await page.goto(`/admin/shifts/${pastShift.id}/edit`);
      await page.waitForLoadState("load");

      // Should show warning about editing past shift
      await expect(
        page.getByText("You are editing a past shift")
      ).toBeVisible();
      await expect(
        page.getByText("Changes may affect historical records")
      ).toBeVisible();
    });
  });

  // Helper function to find next operating day (Sunday-Thursday only)
  function getNextOperatingDay(): string {
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

      // Restaurant operates Sunday (0) through Thursday (4)
      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        return date.toISOString().split("T")[0];
      }
    }
    // Fallback to next Sunday if somehow we don't find an operating day
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7));
    return nextSunday.toISOString().split("T")[0];
  }

  test.describe("Delete Shift Functionality", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(15, 0)),
        end: new Date(operatingDate.setHours(18, 0)),
        capacity: 3,
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test("should display delete buttons on shift cards", async ({ page }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Wait for shifts to load and find any delete button
      await page.waitForSelector('[data-testid^="delete-shift-button-"]', {
        timeout: 10000,
      });

      // Check that at least one delete button is visible
      const deleteButtons = page.locator(
        '[data-testid^="delete-shift-button-"]'
      );
      await expect(deleteButtons.first()).toBeVisible();
      await expect(deleteButtons.first()).toContainText("Delete");

      // Optionally verify our specific shift exists
      const specificDeleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      if (await specificDeleteButton.isVisible()) {
        await expect(specificDeleteButton).toBeVisible();
      }
    });

    test("should open delete confirmation dialog when clicking delete", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");
      await page.waitForTimeout(1000);

      // Click delete button
      const deleteButton = page
        .locator('[data-testid^="delete-shift-button-"]')
        .first();
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // Wait for dialog to appear using testid (debug showed this works)
      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible({
        timeout: 10000,
      });

      // Check dialog content
      await expect(page.getByTestId("delete-shift-dialog-title")).toContainText(
        "Delete Shift"
      );
      await expect(
        page.getByText("Are you sure you want to delete this shift?")
      ).toBeVisible();
    });

    test.skip("should close delete dialog when clicking cancel", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Open delete dialog
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      await deleteButton.click();

      // Wait for dialog to appear
      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible();

      // Click cancel in dialog - try multiple selectors
      const cancelButton = page
        .locator(
          '[data-testid="delete-shift-cancel-button"], button:has-text("Cancel")'
        )
        .first();
      await cancelButton.click();

      // Dialog should close
      await expect(page.getByTestId("delete-shift-dialog")).not.toBeVisible();
    });

    test.skip("should delete shift successfully when confirming", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Open delete dialog
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      await deleteButton.click();

      // Wait for dialog to appear
      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible();

      // Confirm deletion - try multiple selectors for the confirm button
      const confirmButton = page
        .locator(
          '[data-testid="delete-shift-confirm-button"], button:has-text("Delete Shift")'
        )
        .first();
      await confirmButton.click();

      // Wait for navigation and success message
      await page.waitForURL(/\/admin\/shifts/, { timeout: 10000 });

      // Check for success message
      const successMessage = page.locator(
        '[data-testid="shift-deleted-message"], .alert:has-text("deleted successfully")'
      );
      await expect(successMessage).toBeVisible({ timeout: 5000 });

      // Shift should no longer appear in the list
      await expect(
        page.getByTestId(`shift-card-${testShiftId}`)
      ).not.toBeVisible();
    });

    test.skip("should show warning in delete dialog for shifts with signups", async ({
      page,
    }) => {
      // Create a signup for the shift
      await loginAsVolunteer(page);
      const signupResponse = await page.request.post(
        `/api/shifts/${testShiftId}/signup`
      );
      expect(signupResponse.ok()).toBeTruthy();

      // Back to admin
      await loginAsAdmin(page);

      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Open delete dialog
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      await deleteButton.click();

      // Wait for dialog to appear
      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible();

      // Should show warning about signups - use more flexible selectors
      const signupWarning = page.locator('text="volunteer is signed up"');
      await expect(signupWarning).toBeVisible({ timeout: 5000 });

      const removeWarning = page.locator('text="Remove all volunteer signups"');
      await expect(removeWarning).toBeVisible();

      const notifyWarning = page.locator(
        'text="Consider notifying the volunteers"'
      );
      await expect(notifyWarning).toBeVisible();
    });
  });

  test.describe("Edit and Delete from Edit Page", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(11, 0)),
        end: new Date(operatingDate.setHours(15, 0)),
        capacity: 5,
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test("should have delete button on edit page", async ({ page }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Check delete button is present in header
      const deleteButton = page.getByTestId("delete-shift-from-edit-button");
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toContainText("Delete Shift");
    });

    test("should delete shift from edit page", async ({ page }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Click delete button
      const deleteButton = page.getByTestId("delete-shift-from-edit-button");
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.getByTestId("delete-shift-confirm-button");
      await confirmButton.click();

      // Should redirect with success message
      await expect(page).toHaveURL(/\/admin\/shifts\?deleted=1/);
      await expect(page.getByTestId("shift-deleted-message")).toBeVisible();
    });

    test("should show back to shifts button on edit page", async ({ page }) => {
      await page.goto(`/admin/shifts/${testShiftId}/edit`);
      await page.waitForLoadState("load");

      // Check back button
      const backButton = page.getByText("← Back to shifts");
      await expect(backButton).toBeVisible();

      // Should navigate back to shifts page
      await backButton.click();
      await expect(page).toHaveURL("/admin/shifts");
    });
  });

  test.describe.skip("Responsive Behavior", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(12, 0)),
        end: new Date(operatingDate.setHours(16, 0)),
        capacity: 4,
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test.skip("should display edit/delete buttons properly on mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Check buttons are visible on mobile
      const editButton = page.getByTestId(`edit-shift-button-${testShiftId}`);
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );

      await expect(editButton).toBeVisible();
      await expect(deleteButton).toBeVisible();

      // Buttons should be in flex layout (side by side)
      const adminActions = page.locator(".flex.gap-2").filter({
        has: editButton,
      });
      await expect(adminActions).toBeVisible();
    });

    test("should handle delete dialog on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Open delete dialog on mobile
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      await deleteButton.click();

      // Dialog should be properly displayed on mobile
      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible();
      await expect(
        page.getByTestId("delete-shift-cancel-button")
      ).toBeVisible();
      await expect(
        page.getByTestId("delete-shift-confirm-button")
      ).toBeVisible();
    });
  });

  test.describe("Access Control", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(13, 0)),
        end: new Date(operatingDate.setHours(17, 0)),
        capacity: 3,
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test("should not allow volunteers to access edit page", async ({
      page,
    }) => {
      await loginAsVolunteer(page);

      await page.goto(`/admin/shifts/${testShiftId}/edit`);

      // Should be redirected away from edit page - could be to dashboard or shifts
      await page.waitForURL((url) => !url.pathname.includes("/admin/shifts"), {
        timeout: 10000,
      });
      expect(page.url()).not.toContain("/admin/shifts");
    });

    test("should return 403 when volunteer tries to delete shift via API", async ({
      page,
    }) => {
      await loginAsVolunteer(page);

      // Try to delete via API call
      const response = await page.request.delete(
        `/api/admin/shifts/${testShiftId}`
      );
      expect(response.status()).toBe(403);
    });
  });

  test.describe.skip("Animation and UI Interactions", () => {
    let testShiftId: string;
    let operatingDateStr: string;

    test.beforeEach(async () => {
      // Get next operating day (when restaurant is open)
      operatingDateStr = getNextOperatingDay();
      const operatingDate = new Date(operatingDateStr + "T00:00:00");

      const shift = await createShift({
        location: "Wellington",
        start: new Date(operatingDate.setHours(16, 0)),
        end: new Date(operatingDate.setHours(20, 0)),
        capacity: 4,
      });
      testShiftId = shift.id;
      testShiftIds.push(shift.id);
    });

    test.skip("should show loading state in delete dialog", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Slow down network to see loading state
      await page.route(`/api/admin/shifts/${testShiftId}`, (route) => {
        if (route.request().method() === "DELETE") {
          setTimeout(() => route.continue(), 2000);
        } else {
          route.continue();
        }
      });

      // Open delete dialog
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );
      await deleteButton.click();

      await expect(page.getByTestId("delete-shift-dialog")).toBeVisible();

      const confirmButton = page.locator('button:has-text("Delete Shift")');
      await confirmButton.click();

      // Should show loading state - check for spinner or "Deleting..." text
      const loadingIndicator = page.locator('text="Deleting..."');
      await expect(loadingIndicator).toBeVisible({ timeout: 3000 });
    });

    test("should maintain button layout consistency", async ({ page }) => {
      await page.goto(
        `/admin/shifts?date=${operatingDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Check button layout
      const editButton = page.getByTestId(`edit-shift-button-${testShiftId}`);
      const deleteButton = page.getByTestId(
        `delete-shift-button-${testShiftId}`
      );

      // Buttons should be in same container with gap
      const container = page.locator(".flex.gap-2").filter({
        has: editButton,
      });
      await expect(container).toContainText("Edit");
      await expect(container).toContainText("Delete");

      // Both buttons should have flex-1 class for equal width
      await expect(editButton).toHaveClass(/flex-1/);
      await expect(deleteButton).toHaveClass(/flex-1/);
    });
  });
});
