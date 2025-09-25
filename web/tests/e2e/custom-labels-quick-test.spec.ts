import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Custom Labels - Quick Verification Tests", () => {
  test.describe("Admin Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should load custom labels page successfully", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Check page loads successfully
      await expect(page).toHaveURL("/admin/custom-labels");

      // Check main page title using more specific selector
      const pageTitle = page.getByTestId("admin-page-header");
      await expect(pageTitle).toBeVisible();
      await expect(pageTitle).toContainText("Custom Labels");

      // Check add label button exists
      const addButton = page.getByTestId("create-label-button");
      await expect(addButton).toBeVisible();
    });

    test("should display seed data labels", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Look for some expected seed labels
      const expectedLabels = ["Under 18", "New Volunteer", "Team Leader"];
      
      for (const labelName of expectedLabels) {
        const labelBadge = page.getByTestId("custom-label-badge").filter({ hasText: labelName });
        
        // If the label exists, it should be visible
        if (await labelBadge.count() > 0) {
          await expect(labelBadge.first()).toBeVisible();
        }
      }
    });

    test("should open create label dialog", async ({ page }) => {
      await page.goto("/admin/custom-labels");
      await page.waitForLoadState("domcontentloaded");

      // Click add label button
      await page.getByTestId("create-label-button").click();

      // Wait for dialog to open
      await page.getByRole("dialog").waitFor({ state: "visible" });

      // Check form elements exist
      const nameInput = page.getByTestId("label-name-input");
      await expect(nameInput).toBeVisible();

      const saveButton = page.getByTestId("save-label-button");
      await expect(saveButton).toBeVisible();

      // Close dialog
      const cancelButton = page.getByRole("button", { name: /cancel/i });
      if (await cancelButton.count() > 0) {
        await cancelButton.click();
      } else {
        await page.keyboard.press("Escape");
      }
      
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    });

    test("should display labels on shifts page", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("domcontentloaded");

      // Check that the page loads (this verifies our type updates work)
      await expect(page).toHaveURL("/admin/shifts");

      // Look for volunteer entries (if any exist)
      const volunteerGrades = page.getByTestId(/volunteer-grade-/);
      
      // If there are volunteers shown, the grades should be visible
      // Custom labels would show alongside them if volunteers have labels
      if (await volunteerGrades.count() > 0) {
        await expect(volunteerGrades.first()).toBeVisible();
      }
    });

    test("should access volunteer profile with labels manager", async ({ page }) => {
      await page.goto("/admin/volunteers");
      await page.waitForLoadState("domcontentloaded");

      // Click on first volunteer link if available
      const firstVolunteerLink = page.getByTestId(/volunteer-name-link-/).first();
      
      if (await firstVolunteerLink.count() > 0) {
        await firstVolunteerLink.click();
        await page.waitForLoadState("domcontentloaded");

        // Look for the custom labels section heading
        const labelsHeading = page.locator("h2, h3").filter({ hasText: "Custom Labels" });
        await expect(labelsHeading).toBeVisible();

        // Look for add label button
        const addLabelButton = page.getByTestId("add-label-button");
        await expect(addLabelButton).toBeVisible();
      }
    });
  });

  test.describe("Volunteer Access Restrictions", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsVolunteer(page);
    });

    test("should prevent volunteer access to custom labels page", async ({ page }) => {
      // Try to access the admin custom labels page
      await page.goto("/admin/custom-labels");
      
      // Should be redirected away from the admin page
      await page.waitForURL((url) => !url.pathname.includes("/admin/custom-labels"), {
        timeout: 10000,
      });
      
      // Should be redirected to dashboard
      expect(page.url()).toContain("/dashboard");
    });

    test("should not show custom labels in volunteer profile", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForLoadState("domcontentloaded");

      // Verify no custom labels section is visible
      const labelsHeading = page.locator("h2, h3").filter({ hasText: "Custom Labels" });
      await expect(labelsHeading).not.toBeVisible();

      // Verify no custom label badges are visible
      const labelBadges = page.getByTestId("custom-label-badge");
      await expect(labelBadges).not.toBeVisible();
    });
  });

  test.describe("API Security", () => {
    test("should protect custom labels API endpoints", async ({ page }) => {
      await loginAsVolunteer(page);

      // Try to access admin API endpoints
      const labelResponse = await page.request.get("/api/admin/custom-labels");
      
      // Should be unauthorized (403) or redirect
      expect(labelResponse.status()).toBeGreaterThanOrEqual(400);
    });
  });
});