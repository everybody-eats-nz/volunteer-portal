import { test, expect } from "@playwright/test";
import {
  login,
  ensureAdmin,
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";

test.describe.serial("Admin Shift Shortage Notifications", () => {
  let adminEmail: string;
  const volunteerEmails: string[] = [];
  let shiftId: string;

  test.beforeEach(async ({ page }) => {
    // Clear volunteer emails from previous test
    volunteerEmails.length = 0;

    // Create admin user
    adminEmail = `admin-notify-${Date.now()}@test.com`;
    await createTestUser(page, adminEmail, "ADMIN");

    // Create test volunteers with different preferences
    const baseTime = Date.now();

    // Volunteer 1: Wellington, opted in
    volunteerEmails.push(`volunteer1-${baseTime}@test.com`);
    await createTestUser(page, volunteerEmails[0], "VOLUNTEER", {
      availableLocations: JSON.stringify(["Wellington"]),
      availableDays: JSON.stringify(["Monday", "Wednesday"]),
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
    });

    // Volunteer 2: Glen Innes, opted in
    volunteerEmails.push(`volunteer2-${baseTime}@test.com`);
    await createTestUser(page, volunteerEmails[1], "VOLUNTEER", {
      availableLocations: JSON.stringify(["Glen Innes"]),
      availableDays: JSON.stringify(["Tuesday", "Thursday"]),
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
    });

    // Login as admin (must happen before creating shifts)
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);

    // Create a test shift
    const shiftData = await createShift(page, {
      location: "Wellington",
      start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      capacity: 10,
    });
    shiftId = shiftData.id;
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await deleteTestUsers(page, [adminEmail, ...volunteerEmails]);
    if (shiftId) {
      await deleteTestShifts(page, [shiftId]);
    }
  });

  test("should load notifications page and show basic filters", async ({
    page,
  }) => {
    await page.goto("/admin/notifications");

    // Check page title
    await expect(
      page.getByRole("heading", { name: "Shift Shortage Notifications" })
    ).toBeVisible();

    // Check filter sections exist
    await expect(page.getByTestId("shift-filter-section")).toBeVisible();
    await expect(page.getByTestId("volunteer-filter-section")).toBeVisible();

    // Check shift location filter dropdown (new UI uses date + location instead of single shift select)
    await expect(page.getByTestId("shift-location-filter")).toBeVisible();

    // Check basic volunteer filters
    await expect(page.getByTestId("location-filter")).toBeVisible();
    await expect(page.getByTestId("shift-type-filter")).toBeVisible();
  });

  test("should show volunteer count when filters are applied", async ({
    page,
  }) => {
    await page.goto("/admin/notifications");

    // Volunteer count is always visible (filters apply to volunteers, not dependent on shift selection)
    await expect(page.getByTestId("volunteer-count")).toBeVisible();
    await expect(page.getByTestId("volunteer-count")).toContainText(
      "volunteers match filters"
    );
  });

  test("should toggle notifications filter", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Notification filter toggle is always visible (not dependent on shift selection)
    await expect(page.getByTestId("notification-filter-toggle")).toBeVisible();

    // Toggle it
    await page.getByTestId("notification-filter-toggle").click();
  });

  test("should show availability filter for selected shift", async ({
    page,
  }) => {
    // Calculate the date 7 days from now (when the test shift was created)
    const shiftDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = shiftDate.toISOString().split("T")[0]; // yyyy-MM-dd format

    // Navigate with URL params to pre-select date and location
    await page.goto(
      `/admin/notifications?date=${dateStr}&location=Wellington`
    );

    // Wait for shifts to load
    await page.waitForSelector('[data-testid^="shift-checkbox-"]', {
      timeout: 10000,
    });

    // Availability filter should be disabled initially (no shifts selected yet)
    await expect(page.getByTestId("availability-filter")).toBeDisabled();

    // Select a shift
    await page.locator('[data-testid^="shift-checkbox-"]').first().click();

    // Availability filter should now be enabled
    await expect(page.getByTestId("availability-filter")).toBeEnabled();
  });

  test("should display email preview button", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Check that preview button is visible
    await expect(page.getByTestId("preview-email-button")).toBeVisible();
    await expect(page.getByTestId("preview-email-button")).toContainText(
      "Preview Email"
    );
  });

  test("should open email preview dialog when button is clicked", async ({
    page,
  }) => {
    await page.goto("/admin/notifications");

    // Click the preview button
    await page.getByTestId("preview-email-button").click();

    // Dialog should open
    await expect(
      page.getByRole("dialog", { name: /Email Template Preview/i })
    ).toBeVisible();

    // Check dialog content headers
    await expect(
      page.getByRole("heading", { name: "Email Template Preview" })
    ).toBeVisible();
    await expect(
      page.getByText("Preview the email template that will be sent to volunteers")
    ).toBeVisible();
  });

  test("should display email preview details in dialog", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Click the preview button
    await page.getByTestId("preview-email-button").click();

    // Wait for dialog to open
    await expect(
      page.getByRole("dialog", { name: /Email Template Preview/i })
    ).toBeVisible();

    // Wait for preview to load (either real data or mock data in dev)
    await expect(
      page.getByText(/Template Name:/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Check that template metadata is displayed
    await expect(page.getByText(/Status:/i).first()).toBeVisible();
    await expect(page.getByText(/From:/i).first()).toBeVisible();
    await expect(page.getByText(/Reply To:/i).first()).toBeVisible();
    await expect(page.getByText(/Subject:/i).first()).toBeVisible();

    // Check that iframe for preview exists
    const iframe = page.frameLocator('iframe[title="Email Preview"]');
    await expect(iframe.locator("body")).toBeVisible({ timeout: 10000 });

    // Check for "Open in New Tab" button
    await expect(
      page.getByRole("button", { name: /Open in New Tab/i })
    ).toBeVisible();
  });

  test("should display note about placeholder variables", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Click the preview button
    await page.getByTestId("preview-email-button").click();

    // Wait for dialog to open
    await expect(
      page.getByRole("dialog", { name: /Email Template Preview/i })
    ).toBeVisible();

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check for the note about placeholder variables
    await expect(
      page.getByText(/This preview shows the template with placeholder variables/i)
    ).toBeVisible();
    await expect(
      page.getByText(/Actual emails will have these replaced with real data/i)
    ).toBeVisible();
  });

  test("should close email preview dialog", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Click the preview button
    await page.getByTestId("preview-email-button").click();

    // Dialog should open
    await expect(
      page.getByRole("dialog", { name: /Email Template Preview/i })
    ).toBeVisible();

    // Close the dialog by pressing Escape
    await page.keyboard.press("Escape");

    // Dialog should be closed
    await expect(
      page.getByRole("dialog", { name: /Email Template Preview/i })
    ).not.toBeVisible();
  });
});
