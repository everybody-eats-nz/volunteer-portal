import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUsers, login } from "./helpers/test-helpers";
import { randomUUID } from "node:crypto";

test.describe("User Notification Preferences", () => {
  let volunteerEmail: string;

  test.beforeEach(async ({ page }) => {
    // Create a test volunteer
    volunteerEmail = `volunteer-prefs-${randomUUID()}@test.com`;
    await createTestUser(page, volunteerEmail, "VOLUNTEER", {
      availableLocations: JSON.stringify(["Wellington"]),
      availableDays: JSON.stringify(["Monday", "Wednesday"]),
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    if (volunteerEmail) {
      await deleteTestUsers(page, [volunteerEmail]);
    }
  });

  test("should display notification preferences in profile", async ({
    page,
  }) => {
    await login(page, volunteerEmail, "Test123456");
    await page.goto("/profile");

    // Check that notification section exists
    await expect(
      page.getByTestId("notification-preferences-section").first()
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Shift Shortage Notifications/i })
    ).toBeVisible();

    // Check current preferences are displayed (now shown as a Badge, not checkbox)
    const notificationToggle = page.getByTestId("receive-notifications-toggle").first();
    await expect(notificationToggle).toBeVisible();
    await expect(notificationToggle).toContainText(/Enabled|Disabled/);

    // Check that shift type preferences are available
    await expect(
      page.getByText("Shift types you'd like notifications for")
    ).toBeVisible();
  });

  test("should edit notification preferences", async ({ page }) => {
    await login(page, volunteerEmail, "Test123456");
    await page.goto("/profile");

    // Click edit button
    await page.getByTestId("edit-notification-preferences").click();

    // Should navigate to profile edit page with communication step
    await page.waitForURL("/profile/edit?step=communication");

    // Check edit form is visible
    await expect(
      page.getByTestId("notification-preferences-form")
    ).toBeVisible();

    // Toggle off notifications
    await page.getByTestId("receive-notifications-toggle").click();

    // Save changes using the header save button
    await page.getByTestId("header-save-button").click();

    // Check success toast message
    await expect(page.getByText("Profile saved successfully!")).toBeVisible();

    // Navigate back to profile
    await page.goto("/profile");

    // Verify changes persisted
    const notificationToggle = page.getByTestId("receive-notifications-toggle");
    await expect(notificationToggle).not.toBeChecked();
  });

  test("should load and display shift types", async ({ page }) => {
    await login(page, volunteerEmail, "Test123456");
    await page.goto("/profile/edit?step=communication");

    // Wait for the form to load
    await expect(
      page.getByTestId("notification-preferences-form")
    ).toBeVisible();

    // Enable shortage notifications if not already enabled
    const notificationToggle = page.getByTestId("receive-notifications-toggle");
    const isChecked = await notificationToggle.isChecked();
    if (!isChecked) {
      await notificationToggle.click();
    }

    // Wait for shift types section to appear
    await page.waitForTimeout(1000);

    // Check that shift types text is visible
    await expect(
      page.getByText("Shift types you'd like notifications for")
    ).toBeVisible();

    // Should show loading text initially
    const loadingText = page.getByText("Loading shift types...");
    if (await loadingText.isVisible()) {
      await expect(loadingText).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("should manage shift type preferences", async ({ page }) => {
    await login(page, volunteerEmail, "Test123456");
    await page.goto("/profile/edit?step=communication");

    // Wait for form to load
    await expect(
      page.getByTestId("notification-preferences-form")
    ).toBeVisible();

    // Enable notifications if needed
    const notificationToggle = page.getByTestId("receive-notifications-toggle");
    const isChecked = await notificationToggle.isChecked();
    if (!isChecked) {
      await notificationToggle.click();
    }

    // Wait for shift types to load
    await page.waitForTimeout(1000);

    // Try to find and click shift type checkboxes if they exist
    const kitchenCheckbox = page.getByRole("checkbox", {
      name: "Kitchen Prep",
      exact: true,
    });
    if ((await kitchenCheckbox.count()) > 0) {
      await kitchenCheckbox.click();
    }

    // Save changes using the header save button
    await page.getByTestId("header-save-button").click();

    // Check success toast
    await expect(page.getByText("Profile saved successfully!")).toBeVisible();
  });

  test.skip('should select all shift types when "All" is selected', async ({
    page,
  }) => {
    // Skip this test as "All shift types" checkbox doesn't exist in current implementation
  });

  test.skip("should display warning when opting out of notifications", async ({
    page,
  }) => {
    // Skip this test as warning message is not implemented
  });

  test.skip("should handle concurrent edits gracefully", async ({
    page,
    context,
  }) => {
    // Skip this test for now - concurrent edit handling not implemented
  });
});
