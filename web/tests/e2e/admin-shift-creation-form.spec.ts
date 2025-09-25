import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

/**
 * Tests for the enhanced admin shift creation form components.
 * 
 * NOTE: These tests require a running database with admin user setup.
 * The tests will fail if:
 * - Database is not running on localhost:5432
 * - Admin user is not properly seeded in the database
 * - Authentication system is not functional
 * 
 * Tests focus on UI component functionality including:
 * - Template management system
 * - Form field interactions
 * - Calendar date pickers
 * - Bulk creation workflow
 * - Form validation
 * - Accessibility features
 */
test.describe("Admin Shift Creation Form", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("Basic Form Structure", () => {
    test("should display shift creation form with main elements", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Check main tabs - Weekly Schedule is now default
      await expect(page.getByRole("tab", { name: "Single Shift" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Weekly Schedule" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Edit Templates" })).toBeVisible();
      
      // Switch to Single Shift to check form sections
      await page.getByRole("tab", { name: "Single Shift" }).click();
      
      // Check form sections are present
      await expect(page.getByText("Quick Templates")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Shift Type" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Location & Capacity" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Additional Information" })).toBeVisible();
    });

    test("should have create shift type functionality", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Check create shift type button exists
      const createButton = page.getByTestId("create-shift-type-button");
      await expect(createButton).toBeVisible();
      await expect(page.getByText("Create New Type")).toBeVisible();
      
      // Open create shift type dialog
      await createButton.click();
      
      // Check dialog content
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Create New Shift Type" })).toBeVisible();
      await expect(page.getByTestId("shift-type-name-input")).toBeVisible();
      await expect(page.getByTestId("shift-type-description-textarea")).toBeVisible();
      await expect(page.getByTestId("create-shift-type-submit")).toBeVisible();
    });
  });

  test.describe("Template Management UI", () => {
    test("should display template management interface", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Edit Templates tab
      await page.getByRole("tab", { name: "Edit Templates" }).click();

      // Check template management interface
      await expect(page.getByText("Manage Shift Templates")).toBeVisible();
      await expect(page.getByRole("button", { name: /Create.*Template/ })).toBeVisible();
      
      // Just check that the create template button is visible
      await expect(page.getByRole("button", { name: /Create.*Template/ })).toBeVisible();
    });

    test("should open add template dialog", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Edit Templates tab
      await page.getByRole("tab", { name: "Edit Templates" }).click();

      // Open add template dialog
      await page.getByRole("button", { name: /Create.*Template/ }).click();
      
      // Check dialog form fields
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Create New Template" })).toBeVisible();
      await expect(page.getByPlaceholder("e.g., Morning Kitchen Shift")).toBeVisible();
      await expect(page.locator('input[type="time"]')).toHaveCount(2); // start and end time
      await expect(page.getByPlaceholder("Number of volunteers")).toBeVisible();
      await expect(page.getByRole("combobox").first()).toBeVisible(); // shift type select
      await expect(page.getByRole("button", { name: "Create Template" })).toBeVisible();
    });
  });

  test.describe("Form Fields and Interactions", () => {
    test("should have all required form fields", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Check main form fields exist
      await expect(page.getByTestId("shift-type-select")).toBeVisible();
      await expect(page.getByTestId("shift-date-input")).toBeVisible();
      await expect(page.getByTestId("shift-start-time-input")).toBeVisible();
      await expect(page.getByTestId("shift-end-time-input")).toBeVisible();
      await expect(page.getByTestId("shift-location-select")).toBeVisible();
      await expect(page.getByTestId("shift-capacity-input")).toBeVisible();
      await expect(page.getByTestId("shift-notes-textarea")).toBeVisible();
      await expect(page.getByTestId("create-shift-button").first()).toBeVisible();
    });

    test("should open calendar picker for date selection", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Click date picker button
      await page.getByTestId("shift-date-input").click();
      
      // Calendar should be visible
      await expect(page.getByRole("dialog")).toBeVisible();
      
      // Check for calendar grid with date buttons
      const dateButtons = page.locator('[role="gridcell"] button');
      await expect(dateButtons.first()).toBeVisible();
    });

    test("should accept manual input in time fields", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Test time inputs accept values
      await page.getByTestId("shift-start-time-input").fill("14:00");
      await expect(page.getByTestId("shift-start-time-input")).toHaveValue("14:00");
      
      await page.getByTestId("shift-end-time-input").fill("18:00");
      await expect(page.getByTestId("shift-end-time-input")).toHaveValue("18:00");
    });

    test("should accept capacity input", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      await page.getByTestId("shift-capacity-input").fill("5");
      await expect(page.getByTestId("shift-capacity-input")).toHaveValue("5");
    });
  });

  test.describe("Weekly Schedule Tab", () => {
    test("should switch to bulk creation tab", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to bulk creation tab
      await page.getByRole("tab", { name: "Weekly Schedule" }).click();
      
      // Check bulk-specific elements
      await expect(page.getByTestId("bulk-start-date-input")).toBeVisible();
      await expect(page.getByTestId("bulk-end-date-input")).toBeVisible();
      await expect(page.getByText("Date Range")).toBeVisible();
      await expect(page.getByText("Days of Week")).toBeVisible();
      await expect(page.getByText("Shift Templates")).toBeVisible();
    });

    test("should have day selection checkboxes", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to bulk creation
      await page.getByRole("tab", { name: "Weekly Schedule" }).click();
      
      // Check day checkboxes exist (using test IDs since labels are abbreviated)
      await expect(page.getByTestId("day-monday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-tuesday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-wednesday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-thursday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-friday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-saturday-checkbox")).toBeVisible();
      await expect(page.getByTestId("day-sunday-checkbox")).toBeVisible();
    });

    test("should open calendar pickers for bulk date range", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to bulk creation
      await page.getByRole("tab", { name: "Weekly Schedule" }).click();
      
      // Click start date picker
      await page.getByTestId("bulk-start-date-input").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      
      // Close and try end date
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
      await page.getByTestId("bulk-end-date-input").click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });
  });

  test.describe("Form Validation", () => {
    test("should have required field indicators", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Check for required field labels (with asterisks)
      await expect(page.getByText("Select shift type *")).toBeVisible();
      await expect(page.getByText("Date *")).toBeVisible();
      await expect(page.getByText("Start time *")).toBeVisible();
      await expect(page.getByText("End time *")).toBeVisible();
      await expect(page.getByText("Location *")).toBeVisible();
      await expect(page.getByText("Volunteer capacity *")).toBeVisible();
    });

    test("should validate capacity input constraints", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      const capacityInput = page.getByTestId("shift-capacity-input");
      
      // Check min attribute
      await expect(capacityInput).toHaveAttribute("min", "1");
      await expect(capacityInput).toHaveAttribute("step", "1");
      await expect(capacityInput).toHaveAttribute("type", "number");
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper form labels and ARIA attributes", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Check tab navigation - Weekly Schedule is now default
      await expect(page.getByRole("tablist")).toBeVisible();
      const singleShiftTab = page.getByRole("tab", { name: "Single Shift" });
      await expect(singleShiftTab).toBeVisible();
      
      // Switch to Single Shift to check form
      await singleShiftTab.click();
      
      // Check form has proper structure
      const form = page.locator("form").first();
      await expect(form).toBeVisible();
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();

      // Test tab navigation
      await page.keyboard.press("Tab");
      const activeElement = page.locator(":focus");
      await expect(activeElement).toBeVisible();
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should be responsive on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/shifts/new");
      await page.waitForLoadState("load");

      // Check that main elements are still visible on mobile
      await expect(page.getByRole("tab", { name: "Single Shift" })).toBeVisible();
      
      // Switch to Single Shift tab
      await page.getByRole("tab", { name: "Single Shift" }).click();
      
      await expect(page.getByTestId("shift-type-select")).toBeVisible();
      await expect(page.getByTestId("create-shift-button").first()).toBeVisible();
    });
  });
});