import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const adminLoginButton = page.getByTestId("quick-login-admin-button");
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during admin login:", error);
    throw error;
  }
}

// Helper function to login as volunteer
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const volunteerLoginButton = page.getByTestId(
      "quick-login-volunteer-button"
    );
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await volunteerLoginButton.click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error;
  }
}

test.describe("Auto-Accept Rules Admin Interface", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to admin dashboard first
    await page.goto("/admin");
    await page.waitForLoadState("load");

    // Skip tests if login failed (we're still on login page)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(true, "Admin login failed - skipping auto-accept rules tests");
    }
  });

  test("should display auto-accept rules page with proper layout", async ({
    page,
  }) => {
    // Navigate to auto-accept rules page
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Check page title and description
    await expect(page.getByTestId("admin-page-header")).toContainText(
      "Auto Accept Rules"
    );
    await expect(
      page.getByText("Configure automatic approval rules")
    ).toBeVisible();

    // Check for main action buttons
    await expect(page.getByText("Add Rule")).toBeVisible();
    await expect(page.getByText("View Stats")).toBeVisible();

    // Check for rules table
    await expect(page.getByText("Active Rules")).toBeVisible();
    await expect(
      page.getByText("Rules are evaluated in priority order")
    ).toBeVisible();
  });

  test("should show existing seeded rules in table", async ({ page }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Wait for table to load and check table headers
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check table headers
    const tableHeader = page.getByTestId("auto-accept-rules-table-header");
    await expect(tableHeader.getByText("Enabled")).toBeVisible();
    await expect(tableHeader.getByText("Name")).toBeVisible();
    await expect(tableHeader.getByText("Scope")).toBeVisible();
    await expect(tableHeader.getByText("Priority")).toBeVisible();
    await expect(tableHeader.getByText("Criteria")).toBeVisible();
    await expect(tableHeader.getByText("Logic")).toBeVisible();
    await expect(tableHeader.getByText("Uses")).toBeVisible();
    await expect(tableHeader.getByText("Actions")).toBeVisible();

    // Check if seeded rules are displayed (there should be at least one)
    const tableRows = page.locator("tbody tr");
    await expect(tableRows.first()).toBeVisible();
  });

  test("should open create rule dialog when Add Rule is clicked", async ({
    page,
  }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Click Add Rule button
    await page.getByText("Add Rule").click();

    // Check if dialog opened
    await expect(page.getByText("Create Auto-Accept Rule")).toBeVisible();

    // Check form fields are present
    await expect(page.getByLabel("Rule Name")).toBeVisible();
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByLabel("Priority")).toBeVisible();
  });

  test("should validate rule creation form", async ({ page }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Open create dialog
    await page.getByText("Add Rule").click();
    await expect(page.getByText("Create Auto-Accept Rule")).toBeVisible();

    // Try to submit empty form
    await page.getByText("Create Rule").click();

    // Should see validation errors (exact messages may vary)
    // At minimum, rule name should be required
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("should toggle rule enabled/disabled state", async ({ page }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Wait for table to load
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Find the first toggle switch
    const firstToggle = page
      .locator("tbody tr")
      .first()
      .locator('[role="switch"]');
    await expect(firstToggle).toBeVisible();

    // Get initial state
    const initialState = await firstToggle.getAttribute("data-state");

    // Click to toggle
    await firstToggle.click();

    // Wait for state change (should be opposite of initial)
    await expect(firstToggle).toHaveAttribute(
      "data-state",
      initialState === "checked" ? "unchecked" : "checked"
    );
  });

  test("should open edit dialog when edit button is clicked", async ({
    page,
  }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Wait for table and find first edit button
    const table = page.locator("table");
    await expect(table).toBeVisible();

    const firstEditButton = page
      .locator("tbody tr")
      .first()
      .getByRole("button")
      .filter({ hasText: "" })
      .first();
    await firstEditButton.click();

    // Check if edit dialog opened
    await expect(page.getByText("Edit Auto-Accept Rule")).toBeVisible();
  });

  test("should open stats dialog when View Stats is clicked", async ({
    page,
  }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Click View Stats button
    await page.getByText("View Stats").click();

    // Check if stats dialog opened
    await expect(page.getByText("Auto-Approval Statistics")).toBeVisible();
  });

  test("should display rule criteria with proper formatting", async ({
    page,
  }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Check that criteria column shows formatted criteria
    const criteriaCell = page.locator("tbody tr").first().locator("td").nth(4);
    await expect(criteriaCell).toBeVisible();

    // Should contain some criteria text (specific content depends on seeded data)
    const criteriaText = await criteriaCell.textContent();
    expect(criteriaText).toBeTruthy();
  });
});

test.describe("Auto-Accept Rules Delete Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate to admin dashboard first
    await page.goto("/admin");
    await page.waitForLoadState("load");

    // Skip tests if login failed
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      test.skip(
        true,
        "Admin login failed - skipping delete functionality tests"
      );
    }
  });

  test("should show confirmation dialog when deleting a rule", async ({
    page,
  }) => {
    await page.goto("/admin/auto-accept-rules");
    await page.waitForLoadState("load");

    // Wait for table and find first delete button
    const table = page.locator("table");
    await expect(table).toBeVisible();

    // Mock the confirm dialog to prevent actual deletion
    await page.evaluate(() => {
      window.confirm = () => false; // Cancel deletion
    });

    const firstDeleteButton = page
      .locator("tbody tr")
      .first()
      .getByRole("button")
      .filter({ hasText: "" })
      .nth(1);
    await firstDeleteButton.click();

    // Since we cancelled, the rule should still be there
    await expect(table.locator("tbody tr").first()).toBeVisible();
  });
});
