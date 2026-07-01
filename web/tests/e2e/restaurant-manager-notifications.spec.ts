import type { Page } from "@playwright/test";
import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { selectFirstOption } from "./helpers/select";

/**
 * Removes every restaurant-manager assignment via the authenticated admin API so
 * each test starts from a known-empty state. Without this the assignment tests
 * are order-dependent: they pick the "first admin" and "first location", so a
 * prior run leaves that admin already assigned - which flips the success toast to
 * an update, the notifications checkbox to the stored value, and (because the
 * selectable-location pool is small) eventually empties the location dropdown.
 * Requires an active admin session, so call after loginAsAdmin().
 */
async function clearRestaurantManagerAssignments(page: Page) {
  const res = await page.request.get("/api/admin/restaurant-managers");
  if (!res.ok()) return;
  const managers: Array<{ id: string }> = await res.json();
  for (const manager of managers) {
    await page.request.delete(`/api/admin/restaurant-managers/${manager.id}`);
  }
}

test.describe("Restaurant Manager Shift Cancellation Notifications", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard
    await loginAsAdmin(page);
    // Start each test from a clean slate so the "first admin/first location"
    // assignment flow is deterministic and order-independent.
    await clearRestaurantManagerAssignments(page);
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
    await selectFirstOption(page.getByTestId("user-select"));

    // Add a location
    await selectFirstOption(page.getByTestId("location-select"));

    // Check notification preference is enabled by default
    const notificationCheckbox = page.getByTestId("notifications-checkbox");
    await expect(notificationCheckbox).toBeChecked();

    // Submit the form
    await page.getByTestId("assign-manager-button").click();

    // Should show success message (assuming toast notifications)
    // The beforeEach clears assignments, so this is always a fresh "create"
    // and the toast reads "Successfully assigned …".
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

    // Ensure at least one manager assignment exists by creating one
    let hasAssignments = await page
      .getByTestId("managers-table")
      .isVisible()
      .catch(() => false);

    if (!hasAssignments) {
      // Create a manager assignment first
      await selectFirstOption(page.getByTestId("user-select"));
      await selectFirstOption(page.getByTestId("location-select"));
      await page.getByTestId("assign-manager-button").click();
      // Wait for the create to confirm rather than a fixed delay.
      await expect(page.getByText(/successfully assigned/i)).toBeVisible({
        timeout: 5000,
      });

      // Reload to see the table
      await page.goto("/admin/restaurant-managers");
      await page.waitForLoadState("load");
      hasAssignments = await page
        .getByTestId("managers-table")
        .isVisible()
        .catch(() => false);
    }

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
    }
  });

  test("admin can remove restaurant manager assignments", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Ensure at least one manager assignment exists
    let hasAssignments = await page
      .getByTestId("managers-table")
      .isVisible()
      .catch(() => false);

    if (!hasAssignments) {
      // Create a manager assignment first
      await selectFirstOption(page.getByTestId("user-select"));
      await selectFirstOption(page.getByTestId("location-select"));
      await page.getByTestId("assign-manager-button").click();
      // Wait for the create to confirm rather than a fixed delay.
      await expect(page.getByText(/successfully assigned/i)).toBeVisible({
        timeout: 5000,
      });

      await page.goto("/admin/restaurant-managers");
      await page.waitForLoadState("load");
      hasAssignments = await page
        .getByTestId("managers-table")
        .isVisible()
        .catch(() => false);
    }

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
    await clearRestaurantManagerAssignments(page);
  });

  test("form validates required fields", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Try to submit form without selecting user
    const submitButton = page.getByTestId("assign-manager-button");
    await expect(submitButton).toBeDisabled();

    // Select a user
    await selectFirstOption(page.getByTestId("user-select"));

    // Selecting an admin who already has an assignment pre-fills their existing
    // locations; clear any so we can assert the "no locations" invariant.
    const removeButtons = page.locator('[data-testid^="remove-location-"]');
    for (let i = 0; i < 10 && (await removeButtons.count()) > 0; i++) {
      await removeButtons.first().click();
    }

    // With a user selected but no locations, submit must stay disabled
    await expect(submitButton).toBeDisabled();
  });

  test("form handles location selection and removal", async ({ page }) => {
    await page.goto("/admin/restaurant-managers");
    await page.waitForLoadState("load");

    // Select a user first
    await selectFirstOption(page.getByTestId("user-select"));

    // Add first location
    await selectFirstOption(page.getByTestId("location-select"));

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
    await selectFirstOption(page.getByTestId("user-select"));

    await selectFirstOption(page.getByTestId("location-select"));

    // Submit form
    await page.getByTestId("assign-manager-button").click();

    // After successful submission, form should reset
    // Note: This test may need adjustment based on actual behavior
    await expect(page.getByTestId("user-select")).toHaveText(
      "Select an admin user..."
    );
  });
});
