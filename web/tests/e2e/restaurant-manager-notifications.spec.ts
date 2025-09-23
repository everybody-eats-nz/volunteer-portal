import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Restaurant Manager Shift Cancellation Notifications", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard
    await loginAsAdmin(page);
  });

  test("admin can assign restaurant managers to locations", async ({
    page,
  }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Check page loads correctly
    await expect(page.getByTestId("admin-page-header")).toBeVisible();
    await expect(
      page.getByText("Assign admins to restaurant locations")
    ).toBeVisible();

    // Wait for form to be fully loaded
    await page.waitForSelector('[data-testid="user-select"]');
    await page.waitForSelector('[data-testid="location-select"]');

    // Check form is present
    await expect(page.getByTestId("admin-user-label")).toBeVisible();
    await expect(page.getByTestId("restaurant-locations-label")).toBeVisible();
    await expect(page.getByTestId("notifications-checkbox")).toBeVisible();

    // Verify assignment form has required elements
    await expect(page.getByTestId("user-select")).toBeVisible(); // User dropdown
    await expect(page.getByTestId("location-select")).toBeVisible(); // Location dropdown
    await expect(page.getByTestId("assign-manager-button")).toBeDisabled(); // Should be disabled initially
  });

  test("restaurant manager assignment workflow", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Select an admin user (assuming we have at least one admin)
    await page.getByTestId("user-select").click();
    await page.locator('[role="option"]').first().click();

    // Add a location
    await page.getByTestId("location-select").click();
    await page.locator('[role="option"]').first().click();

    // Check notification preference is enabled by default
    const notificationCheckbox = page.getByTestId("notifications-checkbox");
    await expect(notificationCheckbox).toBeChecked();

    // Submit the form
    await page.getByTestId("assign-manager-button").click();

    // Should show success message (assuming toast notifications)
    // Note: This might need to be adjusted based on your actual toast implementation
    await expect(page.getByText(/successfully assigned/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("admin can view and manage restaurant manager assignments", async ({
    page,
  }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Check that the assignments section is visible
    const assignmentsSection = page.getByText("Current Assignments");
    await expect(assignmentsSection).toBeVisible();

    // Wait for loading to complete
    const loadingState = page.getByTestId("loading-managers");
    try {
      await expect(loadingState).toBeHidden({ timeout: 5000 });
    } catch {
      // Loading state might not appear if load is fast
    }

    // Now check if we have a table or empty state
    const table = page.getByTestId("managers-table");
    const emptyState = page.getByTestId("empty-managers-state");

    try {
      // Try to find the table first
      await expect(table).toBeVisible({ timeout: 3000 });

      // If table exists, verify its structure
      await expect(page.getByTestId("manager-column-header")).toBeVisible();
      await expect(page.getByTestId("locations-column-header")).toBeVisible();
      await expect(
        page.getByTestId("notifications-column-header")
      ).toBeVisible();
      await expect(page.getByTestId("actions-column-header")).toBeVisible();
    } catch {
      // If no table, should show empty state
      await expect(emptyState).toBeVisible();
    }
  });

  test("admin can toggle notification preferences for managers", async ({
    page,
  }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // This test assumes there's at least one manager assignment
    // Check if there are any existing assignments
    const hasAssignments = await page
      .getByTestId("managers-table")
      .isVisible()
      .catch(() => false);

    if (hasAssignments) {
      // Find notification toggle buttons (Bell icons)
      const notificationToggle = page
        .locator('[data-testid^="notification-toggle-"]')
        .first();

      if (await notificationToggle.isVisible()) {
        await notificationToggle.click();

        // Should show confirmation (toast or similar)
        await expect(
          page.getByText(/notifications.*enabled|disabled/i)
        ).toBeVisible({ timeout: 5000 });
      }
    } else {
      // Skip test if no assignments exist
      test.skip(
        true,
        "No restaurant manager assignments exist to test notification toggle"
      );
    }
  });

  test("admin can remove restaurant manager assignments", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // This test assumes there's at least one manager assignment
    const hasAssignments = await page
      .getByTestId("managers-table")
      .isVisible()
      .catch(() => false);

    if (hasAssignments) {
      // Find delete button (Trash icon)
      const deleteButton = page
        .locator('[data-testid^="delete-manager-"]')
        .first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        await expect(page.getByText("Remove Manager Assignment")).toBeVisible();
        await expect(
          page.getByText(/are you sure you want to remove/i)
        ).toBeVisible();

        // Cancel the deletion
        await page.getByTestId("cancel-delete-button").click();

        // Dialog should close
        await expect(
          page.getByText("Remove Manager Assignment")
        ).not.toBeVisible();
      }
    } else {
      // Skip test if no assignments exist
      test.skip(
        true,
        "No restaurant manager assignments exist to test deletion"
      );
    }
  });

  test("restaurant managers navigation link is visible in admin dashboard", async ({
    page,
  }) => {
    await page.goto("/admin");

    // Check that the Restaurant Managers link is in the Quick Actions section
    await expect(page.getByTestId("restaurant-managers-button")).toBeVisible();

    // Click the link and verify navigation
    await page.getByTestId("restaurant-managers-button").click();
    await expect(page).toHaveURL("/admin/restaurant-managers");
    await expect(page.getByTestId("admin-page-header")).toBeVisible();
  });
});

test.describe("Shift Cancellation Notification Flow", () => {
  test("volunteer can cancel shift and system handles notification flow", async ({
    page,
  }) => {
    // This is an integration test that verifies the entire cancellation flow
    // Note: This test assumes there's a shift with a volunteer signed up

    await loginAsVolunteer(page);
    await page.goto("/shifts/mine");

    // Check if user has any shifts to cancel
    const hasShifts = await page
      .getByTestId("cancel-shift-button")
      .isVisible()
      .catch(() => false);

    if (hasShifts) {
      // Click cancel button
      await page.getByTestId("cancel-shift-button").first().click();

      // Should show confirmation dialog
      await expect(page.getByTestId("cancel-shift-dialog")).toBeVisible();
      await expect(page.getByTestId("cancel-dialog-title")).toHaveText(
        "Cancel Shift Signup"
      );

      // Confirm cancellation
      await page.getByTestId("confirm-cancel-button").click();

      // Should redirect/refresh and show updated status
      await expect(page.getByTestId("cancel-shift-dialog")).not.toBeVisible();

      // Note: The actual notification sending is tested at the API level
      // The UI should just show that the cancellation was successful
    } else {
      test.skip(true, "No shifts available to test cancellation");
    }
  });

  test("API endpoints reject unauthorized access", async ({ page }) => {
    await loginAsVolunteer(page);

    // Test that restaurant manager endpoints are protected
    const response = await page.request.get("/api/admin/restaurant-managers");
    expect(response.status()).toBe(403);

    // Test that users endpoint is protected
    const usersResponse = await page.request.get("/api/admin/users");
    expect(usersResponse.status()).toBe(403);
  });
});

test.describe("Restaurant Manager Assignment Data Validation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("form validates required fields", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Try to submit form without selecting user
    const submitButton = page.getByTestId("assign-manager-button");
    await expect(submitButton).toBeDisabled();

    // Select a user but no locations
    await page.getByTestId("user-select").click();
    await page.locator('[role="option"]').first().click();

    // Submit button should still be disabled
    await expect(submitButton).toBeDisabled();
  });

  test("form handles location selection and removal", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Select a user first
    await page.getByTestId("user-select").click();
    await page.locator('[role="option"]').first().click();

    // Add multiple locations
    const locationDropdown = page.getByTestId("location-select");

    // Add first location
    await locationDropdown.click();
    await page.locator('[role="option"]').first().click();

    // Should show selected location as badge
    await expect(page.getByTestId("selected-locations")).toBeVisible();

    // Form should now be submittable
    await expect(page.getByTestId("assign-manager-button")).toBeEnabled();
  });

  test("assignment form resets after successful submission", async ({
    page,
  }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Fill out form
    await page.getByTestId("user-select").click();
    await page.locator('[role="option"]').first().click();

    await page.getByTestId("location-select").click();
    await page.locator('[role="option"]').first().click();

    // Submit form
    await page.getByTestId("assign-manager-button").click();

    // After successful submission, form should reset
    // Note: This test may need adjustment based on actual behavior
    await expect(page.getByTestId("user-select")).toHaveText(
      "Select an admin user..."
    );
  });
});
