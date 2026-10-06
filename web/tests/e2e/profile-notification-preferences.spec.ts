import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUsers,
  login,
  visibleTestId,
} from "./helpers/test-helpers";
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
      page.getByRole("heading", {
        name: /Shift Announcements and Volunteer Notifications/i,
      })
    ).toBeVisible();

    // Check current preferences are displayed (now shown as a Badge, not checkbox)
    const notificationToggle = page.getByTestId("receive-notifications-toggle").first();
    await expect(notificationToggle).toBeVisible();
    await expect(notificationToggle).toHaveText(/^(On|Off)$/);

    // Shift and urgent messages are mandatory and shown as always on
    await expect(page.getByTestId("shift-notifications-status")).toHaveText(
      "Always on"
    );
    await expect(page.getByTestId("urgent-messages-status")).toHaveText(
      "Always on"
    );

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

    // Toggle off notifications (scope to the form to avoid matching the profile page badge)
    await page
      .getByTestId("notification-preferences-form")
      .getByTestId("receive-notifications-toggle")
      .click();

    // Save changes using the header save button
    await page.getByTestId("header-save-button").click();

    // Check success toast message
    await expect(page.getByText("Profile saved successfully!")).toBeVisible();

    // Navigate back to profile
    await page.goto("/profile");
    await page.waitForLoadState("load");

    // Verify changes persisted - the profile page shows the shortage status as "Off"
    const notificationToggle = page.getByTestId("receive-notifications-toggle").first();
    await expect(notificationToggle).toBeVisible();
    await expect(notificationToggle).toHaveText("Off");
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

  test("should opt out of promotional announcements", async ({ page }) => {
    await login(page, volunteerEmail, "Test123456");
    await page.goto("/profile");

    // The profile streams in, so a hidden staging copy can briefly exist
    const promoStatus = visibleTestId(page, "promotional-announcements-status");
    await expect(promoStatus).toHaveText("On");

    await page.goto("/profile/edit?step=communication");
    const announcements = page.getByTestId("announcement-preferences");
    await expect(announcements).toBeVisible();

    // Shift-related and urgent announcements can't be switched off
    await expect(announcements.getByTestId("announcement-mandatory")).toContainText(
      "Always on"
    );

    const promoToggle = page.getByTestId("announcement-promotional-toggle");
    await expect(promoToggle).toBeChecked();
    await promoToggle.click();
    await expect(promoToggle).not.toBeChecked();

    await page.getByTestId("header-save-button").click();
    await expect(page.getByText("Profile saved successfully!")).toBeVisible();

    await page.goto("/profile");
    await expect(promoStatus).toHaveText("Off");

    // The opt-out is loaded back into the form
    await page.goto("/profile/edit?step=communication");
    await expect(
      page.getByTestId("announcement-promotional-toggle")
    ).not.toBeChecked();
  });

  // NOTE: The following tests are skipped as the features are not implemented:
  // - "All shift types" checkbox doesn't exist in current implementation
  // - Warning message when opting out of notifications is not implemented
  // - Concurrent edit handling is not implemented
});
