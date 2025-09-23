import { test, expect } from "@playwright/test";
import {
  login,
  ensureAdmin,
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";

test.describe("Admin Shift Shortage Notifications", () => {
  let adminEmail: string;
  const volunteerEmails: string[] = [];
  let shiftId: string;

  test.beforeEach(async ({ page }) => {
    // Create admin user
    adminEmail = `admin-notify-${Date.now()}@test.com`;
    await createTestUser(adminEmail, "ADMIN");

    // Create test volunteers with different preferences
    const baseTime = Date.now();

    // Volunteer 1: Wellington, opted in
    volunteerEmails.push(`volunteer1-${baseTime}@test.com`);
    await createTestUser(volunteerEmails[0], "VOLUNTEER", {
      availableLocations: JSON.stringify(["Wellington"]),
      availableDays: JSON.stringify(["Monday", "Wednesday"]),
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
    });

    // Volunteer 2: Glen Innes, opted in
    volunteerEmails.push(`volunteer2-${baseTime}@test.com`);
    await createTestUser(volunteerEmails[1], "VOLUNTEER", {
      availableLocations: JSON.stringify(["Glen Innes"]),
      availableDays: JSON.stringify(["Tuesday", "Thursday"]),
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
    });

    // Create a test shift
    const shiftData = await createShift({
      location: "Wellington",
      start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      capacity: 10,
    });
    shiftId = shiftData.id;

    // Login as admin
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);
  });

  test.afterEach(async () => {
    // Clean up test data
    await deleteTestUsers([adminEmail, ...volunteerEmails]);
    if (shiftId) {
      await deleteTestShifts([shiftId]);
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

    // Check shift selection dropdown
    await expect(page.getByTestId("shift-select")).toBeVisible();

    // Check basic volunteer filters
    await expect(page.getByTestId("location-filter")).toBeVisible();
    await expect(page.getByTestId("shift-type-filter")).toBeVisible();
  });

  test("should show volunteer count when filters are applied", async ({
    page,
  }) => {
    await page.goto("/admin/notifications");

    // Select a shift first
    await page.getByTestId("shift-select").click();
    await page.getByRole("option").first().click();

    // Check volunteer count is displayed
    await expect(page.getByTestId("volunteer-count")).toBeVisible();
    await expect(page.getByTestId("volunteer-count")).toContainText(
      "volunteers match filters"
    );
  });

  test("should toggle notifications filter", async ({ page }) => {
    await page.goto("/admin/notifications");

    // Select a shift first
    await page.getByTestId("shift-select").click();
    await page.getByRole("option").first().click();

    // Check notifications filter toggle exists
    await expect(page.getByTestId("notification-filter-toggle")).toBeVisible();

    // Toggle it
    await page.getByTestId("notification-filter-toggle").click();
  });

  test("should show availability filter for selected shift", async ({
    page,
  }) => {
    await page.goto("/admin/notifications");

    // Availability filter should be disabled initially
    await expect(page.getByTestId("availability-filter")).toBeDisabled();

    // Select a shift
    await page.getByTestId("shift-select").click();
    await page.getByRole("option").first().click();

    // Availability filter should now be enabled
    await expect(page.getByTestId("availability-filter")).toBeEnabled();
  });
});
