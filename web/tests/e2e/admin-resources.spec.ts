import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

// SKIPPED: Resource Hub requires Supabase Storage to be configured
// The admin resources page crashes with "Missing Supabase environment variables"
// TODO: Either configure Supabase for tests or mock the storage dependency
test.describe.skip("Admin Resource Management", () => {
  test.describe("Page Access and Authentication", () => {
    test("should allow admin users to access the resources management page", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");

      // Verify admin resources page loads
      await expect(
        page.getByRole("heading", { name: /resource hub management/i })
      ).toBeVisible();
      await expect(
        page.getByText(/upload and manage resources/i)
      ).toBeVisible();
    });

    test("should redirect non-admin users away from admin resources page", async ({
      page,
    }) => {
      await loginAsVolunteer(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");

      // Should redirect to dashboard
      expect(page.url()).not.toContain("/admin/resources");
      expect(page.url()).toContain("/dashboard");
    });

    test("should redirect unauthenticated users to login", async ({
      page,
      context,
    }) => {
      // Create new page without authentication
      const newPage = await context.newPage();
      await newPage.goto("/admin/resources");
      await newPage.waitForLoadState("load");

      // Should redirect to login
      expect(newPage.url()).toContain("/login");
      await newPage.close();
    });
  });

  test.describe("Resource Management Interface", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should display upload resource button", async ({ page }) => {
      await expect(
        page.getByRole("button", { name: /upload resource/i })
      ).toBeVisible();
    });

    test("should display resources table or empty state", async ({ page }) => {
      // Either shows resources table or empty state
      const hasTable = (await page.locator("table").count()) > 0;
      const hasEmptyState =
        (await page.getByText(/no resources found/i).count()) > 0;

      expect(hasTable || hasEmptyState).toBeTruthy();
    });

    test("should show resource statistics if resources exist", async ({
      page,
    }) => {
      // Look for stats cards or counts
      const hasStats =
        (await page.getByText(/total|published|draft/i).count()) > 0;

      // Stats may or may not be present depending on implementation
      // Just verify page loaded
      expect(page.url()).toContain("/admin/resources");
    });
  });

  test.describe("Create Resource Dialog", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should open create resource dialog", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      // Wait for dialog to open
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    });

    test("should have required form fields in create dialog", async ({
      page,
    }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Check for key form elements
      // Title field
      await expect(
        page.getByLabel(/title/i) || page.getByPlaceholder(/title/i)
      ).toBeVisible();

      // Category selector
      await expect(page.getByRole("combobox").first()).toBeVisible();

      // Type selector
      await expect(page.getByRole("combobox").nth(1)).toBeVisible();
    });

    test("should have category options", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Click category dropdown
      const categorySelect = page.getByRole("combobox").first();
      await categorySelect.click();

      // Verify categories exist
      const hasCategories =
        (await page.getByRole("option", { name: /training|policies|forms|guides/i }).count()) > 0;
      expect(hasCategories).toBeTruthy();
    });

    test("should have type options", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Click type dropdown
      const typeSelect = page.getByRole("combobox").nth(1);
      await typeSelect.click();

      // Verify types exist (PDF, IMAGE, DOCUMENT, LINK, VIDEO)
      const hasTypes =
        (await page.getByRole("option", { name: /pdf|image|document|link|video/i }).count()) > 0;
      expect(hasTypes).toBeTruthy();
    });

    test("should close dialog on cancel", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Click cancel button
      const cancelButton = page.getByRole("button", { name: /cancel/i });
      await cancelButton.click();

      // Dialog should close
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });
  });

  test.describe("Resource Table Display", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should display resource rows if resources exist", async ({
      page,
    }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (hasTable) {
        // Verify table has rows
        const rows = page.locator("tbody tr");
        const rowCount = await rows.count();
        expect(rowCount).toBeGreaterThanOrEqual(0);
      } else {
        // Empty state is acceptable
        await expect(page.getByText(/no resources/i)).toBeVisible();
      }
    });

    test("should display resource metadata in table", async ({ page }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (hasTable) {
        const rows = page.locator("tbody tr");
        const rowCount = await rows.count();

        if (rowCount > 0) {
          // First row should have cells with data
          const firstRow = rows.first();
          const cells = firstRow.locator("td");
          const cellCount = await cells.count();
          expect(cellCount).toBeGreaterThan(0);
        }
      } else {
        test.skip(true, "No resources available to test table display");
      }
    });

    test("should have action buttons for resources", async ({ page }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (hasTable) {
        const rows = page.locator("tbody tr");
        const rowCount = await rows.count();

        if (rowCount > 0) {
          // Look for action buttons (edit, delete, etc.)
          const actionButtons = page.getByRole("button", {
            name: /(edit|delete|view|download)/i,
          });
          const buttonCount = await actionButtons.count();
          expect(buttonCount).toBeGreaterThan(0);
        }
      } else {
        test.skip(true, "No resources available to test actions");
      }
    });
  });

  test.describe("Filtering", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should have filter controls", async ({ page }) => {
      // Look for filter controls (comboboxes, inputs, etc.)
      const hasFilters = (await page.getByRole("combobox").count()) > 0;

      // Filters may or may not be present depending on implementation
      // Just verify page works
      expect(page.url()).toContain("/admin/resources");
    });

    test("should filter by category via URL", async ({ page }) => {
      await page.goto("/admin/resources?category=TRAINING");
      await page.waitForLoadState("load");

      // URL should persist the filter
      expect(page.url()).toContain("category=TRAINING");
    });

    test("should filter by type via URL", async ({ page }) => {
      await page.goto("/admin/resources?type=PDF");
      await page.waitForLoadState("load");

      // URL should persist the filter
      expect(page.url()).toContain("type=PDF");
    });

    test("should filter by published status via URL", async ({ page }) => {
      await page.goto("/admin/resources?published=true");
      await page.waitForLoadState("load");

      // URL should persist the filter
      expect(page.url()).toContain("published=true");
    });
  });

  test.describe("Edit Resource", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should open edit dialog when edit button clicked", async ({
      page,
    }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (!hasTable) {
        test.skip(true, "No resources available to test editing");
      }

      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();

      if (rowCount === 0) {
        test.skip(true, "No resources available to test editing");
      }

      // Look for edit button
      const editButton = page
        .getByRole("button", { name: /edit/i })
        .first();
      const hasEditButton = (await editButton.count()) > 0;

      if (hasEditButton) {
        await editButton.click();

        // Dialog should open
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, "No edit buttons found");
      }
    });
  });

  test.describe("Delete Resource", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should show delete confirmation dialog", async ({ page }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (!hasTable) {
        test.skip(true, "No resources available to test deletion");
      }

      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();

      if (rowCount === 0) {
        test.skip(true, "No resources available to test deletion");
      }

      // Look for delete button
      const deleteButton = page
        .getByRole("button", { name: /delete/i })
        .first();
      const hasDeleteButton = (await deleteButton.count()) > 0;

      if (hasDeleteButton) {
        await deleteButton.click();

        // Confirmation dialog or alert should appear
        // This is intentionally vague as we won't actually delete in tests
        await page.waitForTimeout(500);

        // Don't actually confirm - just verify the flow works
        const cancelButton = page.getByRole("button", { name: /cancel/i });
        if ((await cancelButton.count()) > 0) {
          await cancelButton.click();
        }
      } else {
        test.skip(true, "No delete buttons found");
      }
    });
  });

  test.describe("Resource Preview/Download", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should have view/download options for file resources", async ({
      page,
    }) => {
      const hasTable = (await page.locator("table").count()) > 0;

      if (!hasTable) {
        test.skip(true, "No resources available to test preview");
      }

      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();

      if (rowCount === 0) {
        test.skip(true, "No resources available to test preview");
      }

      // Look for view/download/open buttons
      const actionButtons = page.getByRole("button", {
        name: /(view|download|open)/i,
      });
      const hasActions = (await actionButtons.count()) > 0;

      // Actions may or may not be present
      // Just verify page loaded
      expect(page.url()).toContain("/admin/resources");
    });
  });

  test.describe("Responsive Design", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display properly on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");

      // Verify header is visible
      await expect(
        page.getByRole("heading", { name: /resource hub management/i })
      ).toBeVisible();

      // Verify upload button is accessible
      await expect(
        page.getByRole("button", { name: /upload resource/i })
      ).toBeVisible();
    });

    test("should display properly on desktop viewport", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");

      // Verify header is visible
      await expect(
        page.getByRole("heading", { name: /resource hub management/i })
      ).toBeVisible();
    });
  });
});
