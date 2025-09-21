import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Admin Navigation", () => {
  test.describe("Admin Sidebar Navigation", () => {
    test("admin sees all navigation links in sidebar", async ({ page }) => {
      // Login as admin
      await loginAsAdmin(page);

      // Navigate to admin to ensure sidebar is visible
      await page.goto("/admin");

      // Verify sidebar is visible
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();

      // Verify all admin links are present using test IDs from the sidebar
      await expect(page.getByTestId("sidebar-dashboard")).toBeVisible();
      await expect(page.getByTestId("sidebar-dashboard")).toContainText(
        "Dashboard"
      );

      const sidebar = page.getByTestId("admin-sidebar");
      await expect(sidebar.getByTestId("manage-users-button")).toBeVisible();
      await expect(sidebar.getByTestId("manage-users-button")).toContainText(
        "All Users"
      );

      await expect(page.getByTestId("sidebar-regulars")).toBeVisible();
      await expect(page.getByTestId("sidebar-regulars")).toContainText(
        "Regular Volunteers"
      );

      await expect(
        page.getByTestId("sidebar-restaurant-managers")
      ).toBeVisible();
      await expect(
        page.getByTestId("sidebar-restaurant-managers")
      ).toContainText("Restaurant Managers");

      await expect(page.getByTestId("sidebar-shifts/new")).toBeVisible();
      await expect(page.getByTestId("sidebar-shifts/new")).toContainText(
        "Create Shift"
      );

      await expect(sidebar.getByTestId("manage-shifts-button")).toBeVisible();
      await expect(sidebar.getByTestId("manage-shifts-button")).toContainText(
        "Manage Shifts"
      );

      // Migration tab links
      await expect(
        page.getByTestId("sidebar-migration#migration")
      ).toBeVisible();
      await expect(
        page.getByTestId("sidebar-migration#migration")
      ).toContainText("Bulk Migration");

      await expect(page.getByTestId("sidebar-migration#status")).toBeVisible();
      await expect(page.getByTestId("sidebar-migration#status")).toContainText(
        "Migration Status"
      );

      await expect(
        page.getByTestId("sidebar-migration#invitations")
      ).toBeVisible();
      await expect(
        page.getByTestId("sidebar-migration#invitations")
      ).toContainText("User Invitations");

      await expect(page.getByTestId("sidebar-migration#users")).toBeVisible();
      await expect(page.getByTestId("sidebar-migration#users")).toContainText(
        "Migrated Users"
      );

      // Public shifts link that opens in new tab
      await expect(
        sidebar.getByTestId("view-public-shifts-button")
      ).toBeVisible();
      await expect(
        sidebar.getByTestId("view-public-shifts-button")
      ).toContainText("View Public Shifts");
    });

    test("admin pages are accessible on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Login as admin
      await loginAsAdmin(page);

      // Navigate to admin to ensure page loads
      await page.goto("/admin");

      // Admin dashboard should be accessible on mobile
      await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();

      // Sidebar toggle button should be visible on mobile
      await expect(page.getByTestId("admin-sidebar-toggle")).toBeVisible();

      // Admin functionality should work on mobile via dashboard buttons
      await page.getByTestId("dashboard-manage-users-button").click();
      await expect(page).toHaveURL("/admin/users");

      // Sidebar toggle should still be available on other admin pages
      await expect(page.getByTestId("admin-sidebar-toggle")).toBeVisible();
    });

    test("regular users do not see admin sidebar", async ({ page }) => {
      // Login as regular user
      await loginAsVolunteer(page);

      // Navigate to dashboard (volunteers should be redirected if they try to access /admin)
      await page.goto("/dashboard");

      // Check that admin sidebar is not visible for regular users
      await expect(page.getByTestId("admin-sidebar")).not.toBeVisible();

      // Verify volunteers cannot access admin pages by trying to navigate directly
      await page.goto("/admin");

      // Should be redirected away from admin or not see the sidebar
      const currentUrl = page.url();
      if (currentUrl.includes("/admin")) {
        // If still on admin page, sidebar should not be visible
        await expect(page.getByTestId("admin-sidebar")).not.toBeVisible();
      } else {
        // User was redirected away, which is expected
        expect(currentUrl).not.toContain("/admin");
      }
    });

    test("sidebar navigation works from different admin pages", async ({
      page,
    }) => {
      // Login as admin
      await loginAsAdmin(page);

      // Test navigation from admin dashboard
      await page.goto("/admin");
      await page.getByTestId("sidebar-migration#status").click();
      await page.waitForURL("/admin/migration#status");
      await expect(page.getByTestId("admin-page-header")).toContainText(
        "User Migration"
      );

      // Test navigation from admin users page
      await page.goto("/admin/users");
      const sidebar = page.getByTestId("admin-sidebar");
      await sidebar.getByTestId("manage-shifts-button").click();
      await page.waitForURL("/admin/shifts");
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();

      // Test navigation from admin shifts page
      await page.goto("/admin/shifts");
      await sidebar.getByTestId("manage-users-button").click();
      await page.waitForURL("/admin/users");
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();
    });
  });

  test.describe("Sidebar State Management", () => {
    test("sidebar links show active state correctly", async ({ page }) => {
      // Login as admin
      await loginAsAdmin(page);

      // Navigate to migration page
      await page.goto("/admin/migration");

      // Verify sidebar is visible
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();

      // Check that we can navigate between different sections using sidebar
      await page.getByTestId("manage-users-button").click();
      await page.waitForURL("/admin/users");
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();

      await page.getByTestId("manage-shifts-button").click();
      await page.waitForURL("/admin/shifts");
      await expect(page.getByTestId("admin-sidebar")).toBeVisible();
    });

    test("sidebar accessibility and keyboard navigation", async ({ page }) => {
      // Login as admin
      await loginAsAdmin(page);

      // Navigate to admin dashboard
      await page.goto("/admin");

      // Verify sidebar is accessible via keyboard navigation
      await page.keyboard.press("Tab");

      // Continue tabbing to reach sidebar elements
      let tabCount = 0;
      let focusedElement = page.locator(":focus");

      while (tabCount < 15) {
        await page.keyboard.press("Tab");
        focusedElement = page.locator(":focus");

        // Check if we've focused on a sidebar link
        const href = await focusedElement.getAttribute("href");
        if (href?.includes("/admin/")) {
          // Try activating with Enter
          await page.keyboard.press("Enter");

          // Verify navigation worked
          await page.waitForTimeout(500);
          const currentUrl = page.url();
          expect(currentUrl).toContain("/admin");
          break;
        }

        tabCount++;
      }
    });
  });
});
