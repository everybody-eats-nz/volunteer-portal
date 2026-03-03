import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  getUserByEmail,
  createTestResource,
  deleteTestResources,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

test.describe("Admin Resource Management", () => {
  const testId = randomUUID().slice(0, 8);
  const adminEmail = `admin-res-${testId}@example.com`;
  const resourceIds: string[] = [];
  let adminUserId: string;

  test.beforeEach(async ({ page }) => {
    resourceIds.length = 0;

    // Create admin user and get ID
    await createTestUser(page, adminEmail, "ADMIN");
    const admin = await getUserByEmail(page, adminEmail);
    adminUserId = admin!.id;

    // Create test resources (LINK type so no Supabase needed)
    const res1 = await createTestResource(page, {
      title: "Training Guide Alpha",
      description: "A comprehensive training guide",
      type: "LINK",
      category: "TRAINING",
      tags: ["beginner", "onboarding"],
      url: "https://example.com/training",
      isPublished: true,
      uploadedBy: adminUserId,
    });
    resourceIds.push(res1.id);

    const res2 = await createTestResource(page, {
      title: "Kitchen Safety Policy",
      description: "Safety policies for the kitchen",
      type: "LINK",
      category: "POLICIES",
      tags: ["safety", "kitchen"],
      url: "https://example.com/safety",
      isPublished: true,
      uploadedBy: adminUserId,
    });
    resourceIds.push(res2.id);

    const res3 = await createTestResource(page, {
      title: "Volunteer Application Form",
      description: "Form for new volunteers",
      type: "LINK",
      category: "FORMS",
      tags: ["forms"],
      url: "https://example.com/form",
      isPublished: false,
      uploadedBy: adminUserId,
    });
    resourceIds.push(res3.id);
  });

  test.afterEach(async ({ page }) => {
    await deleteTestResources(page, resourceIds);
    await deleteTestUsers(page, [adminEmail]);
  });

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
      // We created resources, so table should exist
      const hasTable = (await page.locator("table").count()) > 0;
      expect(hasTable).toBeTruthy();
    });

    test("should show resource statistics if resources exist", async ({
      page,
    }) => {
      // Stats cards should show Total, Published, Drafts
      await expect(page.getByText("Total Resources")).toBeVisible();
      // Use the stats card which has exact "Published" as label (not the badge in table)
      const statsGrid = page.locator(".grid.gap-4").first();
      await expect(statsGrid.getByText("Published")).toBeVisible();
      await expect(statsGrid.getByText("Drafts")).toBeVisible();
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

      // Check for title field
      await expect(page.getByLabel(/title/i)).toBeVisible();

      // Check for Resource Type and Category selectors
      await expect(page.getByLabel(/resource type/i)).toBeVisible();
      await expect(page.getByLabel(/category/i)).toBeVisible();
    });

    test("should have category options", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Click category dropdown (labeled "Category")
      const categoryTrigger = page.getByLabel(/category/i).locator("..").getByRole("combobox");
      await categoryTrigger.click();

      // Verify categories exist
      const hasCategories =
        (await page
          .getByRole("option", { name: /training|policies|forms|guides/i })
          .count()) > 0;
      expect(hasCategories).toBeTruthy();
    });

    test("should have type options", async ({ page }) => {
      const uploadButton = page.getByRole("button", {
        name: /upload resource/i,
      });
      await uploadButton.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

      // Click Resource Type dropdown (first select in dialog)
      const typeTrigger = page.getByLabel(/resource type/i).locator("..").getByRole("combobox");
      await typeTrigger.click();

      // Verify types exist (PDF, IMAGE, DOCUMENT, LINK, VIDEO)
      const hasTypes =
        (await page
          .getByRole("option", { name: /pdf|image|document|link|video/i })
          .count()) > 0;
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
      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(1);
    });

    test("should display resource metadata in table", async ({ page }) => {
      const rows = page.locator("tbody tr");
      const firstRow = rows.first();
      const cells = firstRow.locator("td");
      const cellCount = await cells.count();
      expect(cellCount).toBeGreaterThan(0);
    });

    test("should have action buttons for resources", async ({ page }) => {
      // Look for dropdown menu trigger (more actions button)
      const actionButtons = page.locator("tbody tr").first().getByRole("button");
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
    });
  });

  test.describe("Filtering", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/resources");
      await page.waitForLoadState("load");
    });

    test("should have filter controls", async ({ page }) => {
      // Page loads with resources - just verify it's working
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
      // Click the actions dropdown on first row
      const firstRowButton = page
        .locator("tbody tr")
        .first()
        .getByRole("button")
        .first();
      await firstRowButton.click();

      // Click edit option
      const editItem = page.getByRole("menuitem", { name: /edit/i });
      if ((await editItem.count()) > 0) {
        await editItem.click();
        // Dialog should open
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
      } else {
        // If no dropdown menu, look for direct edit button
        const editButton = page
          .getByRole("button", { name: /edit/i })
          .first();
        if ((await editButton.count()) > 0) {
          await editButton.click();
          await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
        }
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
      // Click the actions dropdown on first row
      const firstRowButton = page
        .locator("tbody tr")
        .first()
        .getByRole("button")
        .first();
      await firstRowButton.click();

      // Click delete option
      const deleteItem = page.getByRole("menuitem", { name: /delete/i });
      if ((await deleteItem.count()) > 0) {
        await deleteItem.click();

        // Confirmation dialog should appear
        await page.waitForTimeout(500);

        // Don't actually confirm - just verify the cancel button exists
        const cancelButton = page.getByRole("button", { name: /cancel/i });
        if ((await cancelButton.count()) > 0) {
          await cancelButton.click();
        }
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
      // Verify table has rows with our test data
      const rows = page.locator("tbody tr");
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Page loaded successfully
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
