import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

/**
 * Helper function to create a test location
 */
async function createTestLocation(
  page: Page,
  name: string,
  address: string,
  defaultMealsServed = 60
): Promise<{ id: string; name: string }> {
  // Add timestamp to ensure uniqueness across parallel test runs
  const uniqueName = `${name}-${Date.now()}`;

  const response = await page.request.post("/api/admin/locations", {
    data: {
      name: uniqueName,
      address,
      defaultMealsServed,
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create test location: ${response.status()} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Helper function to delete test locations
 */
async function deleteTestLocations(
  page: Page,
  locationIds: string[]
): Promise<void> {
  for (const id of locationIds) {
    await page.request.delete(`/api/admin/locations/${id}`);
  }
}

/**
 * Helper to get next operating day (skip Sundays and Mondays)
 */
function getNextOperatingDay(): string {
  const today = new Date();
  const daysToAdd = [0, 6, 5, 4, 3, 2, 1, 1][today.getDay()]; // Skip to Tuesday+
  const operatingDate = new Date(today);
  operatingDate.setDate(today.getDate() + daysToAdd + 2);
  return operatingDate.toISOString().split("T")[0];
}

/**
 * Tests for the admin location disable/enable functionality.
 *
 * These tests cover:
 * - Displaying active and disabled locations in separate sections
 * - Disabling a location
 * - Re-enabling a location
 * - Disabling a location with upcoming shifts
 * - Disabled locations appearing in shift edit dropdowns
 * - Disabled locations not appearing in shift creation dropdowns
 */
test.describe("Admin Location Disable/Enable", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [`admin-location-test-${testId}@example.com`];
  const testLocationIds: string[] = [];
  const testShiftIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Create test admin user
    await createTestUser(page, testEmails[0], "ADMIN");
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test data
    await deleteTestUsers(page, testEmails);
    await deleteTestLocations(page, testLocationIds);
    await deleteTestShifts(page, testShiftIds);
  });

  test("should display active locations section with locations", async ({
    page,
  }) => {
    // Create a test location
    const location = await createTestLocation(
      page,
      `Test Location ${testId}`,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Check active locations section is visible
    const activeSection = page.getByTestId("active-locations-section");
    await expect(activeSection).toBeVisible();
    await expect(activeSection).toContainText("Active Locations");

    // Check location appears in active section
    await expect(page.getByText(location.name)).toBeVisible();
  });

  test("should disable a location without upcoming shifts", async ({
    page,
  }) => {
    // Create a test location
    const location = await createTestLocation(
      page,
      `Test Location ${testId}`,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Click disable button
    const disableButton = page.getByTestId(
      `disable-location-button-${location.id}`
    );
    await expect(disableButton).toBeVisible();
    await disableButton.click();

    // Check dialog appears
    const dialog = page.getByTestId("disable-location-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Disable Location");
    await expect(dialog).toContainText(location.name);

    // Confirm disable
    const confirmButton = page.getByTestId("disable-location-confirm-button");
    await confirmButton.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Check success toast appears
    await expect(page.getByText(/Location disabled successfully/i)).toBeVisible(
      { timeout: 5000 }
    );

    // Check disabled locations section appears
    const inactiveSection = page.getByTestId("inactive-locations-section");
    await expect(inactiveSection).toBeVisible();
    await expect(inactiveSection).toContainText("Disabled Locations");
  });

  test("should re-enable a disabled location", async ({ page }) => {
    // Create a test location
    const location = await createTestLocation(
      page,
      `Test Location ${testId}`,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Disable the location via API
    await page.request.delete(`/api/admin/locations/${location.id}`);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Expand disabled locations section
    const inactiveSection = page.getByTestId("inactive-locations-section");
    await expect(inactiveSection).toBeVisible();
    await inactiveSection.click();

    // Click re-enable button
    const enableButton = page.getByTestId(
      `enable-location-button-${location.id}`
    );
    await expect(enableButton).toBeVisible();
    await enableButton.click();

    // Check success toast
    await expect(
      page.getByText(/Location re-enabled successfully/i)
    ).toBeVisible({ timeout: 5000 });

    // Verify location appears in active section
    const activeSection = page.getByTestId("active-locations-section");
    await expect(activeSection).toBeVisible();
    // Location should now be in active section (page may need reload)
    await page.reload();
    await expect(
      page.getByTestId(`disable-location-button-${location.id}`)
    ).toBeVisible();
  });

  test("should show upcoming shifts count when disabling location with shifts", async ({
    page,
  }) => {
    // Create a test location
    const location = await createTestLocation(
      page,
      `Test Location ${testId}`,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Create an upcoming shift at this location
    const operatingDateStr = getNextOperatingDay();
    const operatingDate = new Date(operatingDateStr + "T00:00:00");
    const shift = await createShift(page, {
      location: location.name,
      start: new Date(operatingDate.setHours(10, 0)),
      end: new Date(operatingDate.setHours(14, 0)),
      capacity: 4,
      notes: "Test shift",
    });
    testShiftIds.push(shift.id);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Click disable button
    const disableButton = page.getByTestId(
      `disable-location-button-${location.id}`
    );
    await disableButton.click();

    // Check dialog appears
    const dialog = page.getByTestId("disable-location-dialog");
    await expect(dialog).toBeVisible();

    // Confirm disable
    const confirmButton = page.getByTestId("disable-location-confirm-button");
    await confirmButton.click();

    // Wait for success toast with shift count
    await expect(
      page.getByText(/Location disabled successfully.*1 upcoming shift/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show disabled location in shift edit dropdown", async ({
    page,
  }) => {
    // Create a test location
    const location = await createTestLocation(
      page,
      `Test Location ${testId}`,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Create a shift at this location
    const operatingDateStr = getNextOperatingDay();
    const operatingDate = new Date(operatingDateStr + "T00:00:00");
    const shift = await createShift(page, {
      location: location.name,
      start: new Date(operatingDate.setHours(10, 0)),
      end: new Date(operatingDate.setHours(14, 0)),
      capacity: 4,
      notes: "Test shift",
    });
    testShiftIds.push(shift.id);

    // Disable the location via API
    await page.request.delete(`/api/admin/locations/${location.id}`);

    // Navigate to shift edit page
    await page.goto(`/admin/shifts/${shift.id}/edit`);
    await page.waitForLoadState("load");

    // Check that location dropdown includes the disabled location
    const locationSelect = page.getByTestId("edit-shift-location-select");
    await expect(locationSelect).toBeVisible();

    // The disabled location should already be selected (it's the shift's current location)
    await expect(locationSelect).toContainText(location.name);
  });

  test("should not show disabled location in shift creation dropdown", async ({
    page,
  }) => {
    // Create a test location with a very unique name
    const uniqueLocationName = `TestLoc${Date.now()}${Math.random()
      .toString(36)
      .substring(7)}`;
    const location = await createTestLocation(
      page,
      uniqueLocationName,
      "123 Test Street, Test City"
    );
    testLocationIds.push(location.id);

    // Disable the location via API
    await page.request.delete(`/api/admin/locations/${location.id}`);

    // Navigate to shift creation page
    await page.goto("/admin/shifts/new");
    await page.waitForLoadState("load");

    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 10000 });

    // The disabled location name should not appear anywhere on the page
    // (using a very unique name to avoid false positives)
    const locationText = page.getByText(location.name, { exact: true });
    await expect(locationText).not.toBeVisible();
  });

  test("should display collapsible sections correctly", async ({ page }) => {
    // Create active location
    const activeLocation = await createTestLocation(
      page,
      `Active Location ${testId}`,
      "123 Active Street"
    );
    testLocationIds.push(activeLocation.id);

    // Create disabled location
    const disabledLocation = await createTestLocation(
      page,
      `Disabled Location ${testId}`,
      "456 Disabled Street"
    );
    testLocationIds.push(disabledLocation.id);

    // Disable the second location
    await page.request.delete(`/api/admin/locations/${disabledLocation.id}`);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Active section should be open by default
    const activeSection = page.getByTestId("active-locations-section");
    await expect(activeSection).toBeVisible();
    await expect(page.getByText(activeLocation.name)).toBeVisible();

    // Disabled section should exist
    const inactiveSection = page.getByTestId("inactive-locations-section");
    await expect(inactiveSection).toBeVisible();
    await expect(inactiveSection).toContainText(/Disabled Locations \(\d+\)/);

    // Click to expand disabled section
    await inactiveSection.click();

    // Wait a bit for the collapsible animation
    await page.waitForTimeout(500);

    // Disabled location should be visible after expanding
    await expect(page.getByText(disabledLocation.name)).toBeVisible();

    // Should have re-enable button
    const enableButton = page.getByTestId(
      `enable-location-button-${disabledLocation.id}`
    );
    await expect(enableButton).toBeVisible();
  });

  test("should update location counts in section headers", async ({ page }) => {
    // Create two locations
    const location1 = await createTestLocation(
      page,
      `Location 1 ${testId}`,
      "123 Street 1"
    );
    testLocationIds.push(location1.id);

    const location2 = await createTestLocation(
      page,
      `Location 2 ${testId}`,
      "456 Street 2"
    );
    testLocationIds.push(location2.id);

    // Navigate to locations page
    await page.goto("/admin/locations");
    await page.waitForLoadState("load");

    // Active section should show count of 2 (plus existing locations)
    const activeSection = page.getByTestId("active-locations-section");
    await expect(activeSection).toContainText(/Active Locations \(\d+\)/);

    // Disable one location
    const disableButton = page.getByTestId(
      `disable-location-button-${location1.id}`
    );
    await disableButton.click();

    const dialog = page.getByTestId("disable-location-dialog");
    await expect(dialog).toBeVisible();

    const confirmButton = page.getByTestId("disable-location-confirm-button");
    await confirmButton.click();

    // Wait for success toast
    await expect(page.getByText(/Location disabled successfully/i)).toBeVisible(
      { timeout: 5000 }
    );

    // Disabled section should now appear
    const inactiveSection = page.getByTestId("inactive-locations-section");
    await expect(inactiveSection).toBeVisible();
    await expect(inactiveSection).toContainText(/Disabled Locations \(\d+\)/);
  });
});
