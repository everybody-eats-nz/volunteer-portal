import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const adminLoginButton = page.getByRole("button", {
      name: /login as admin/i,
    });
    await adminLoginButton.waitFor({ state: "visible", timeout: 5000 });
    await adminLoginButton.click();

    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    } catch (error) {
      console.log("Admin login may have failed or taken too long");
    }

    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during admin login:", error);
  }
}

// Helper function to login as volunteer
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    const volunteerLoginButton = page.getByRole("button", {
      name: /login as volunteer/i,
    });
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 5000 });
    await volunteerLoginButton.click();

    try {
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 10000,
      });
    } catch (error) {
      console.log("Volunteer login may have failed or taken too long");
    }

    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during volunteer login:", error);
  }
}

test.describe("Mobile Navigation", () => {
  test.describe("Hamburger Menu", () => {
    test("should show hamburger menu on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Hamburger menu should be visible on mobile
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await expect(hamburgerButton).toBeVisible();

      // Logo should still be visible in header
      const logo = page.locator("header").getByAltText("Everybody Eats");
      await expect(logo).toBeVisible();
    });

    test("should hide hamburger menu on desktop viewport", async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Hamburger menu should not be visible on desktop
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await expect(hamburgerButton).not.toBeVisible();
    });

    test("should open mobile menu when hamburger is clicked", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Click hamburger menu
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await hamburgerButton.click();

      // Menu should be visible with navigation options (in mobile menu specifically)
      const mobileMenu = page.locator(".lg\\:hidden nav");
      await expect(
        mobileMenu.getByRole("link", { name: "Browse Shifts" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "Join Us" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "Login" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByText("Theme", { exact: true })
      ).toBeVisible();
    });

    test("should close mobile menu when navigation link is clicked", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Open menu
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await hamburgerButton.click();

      // Click a navigation link in the mobile menu
      const mobileMenu = page.locator(".lg\\:hidden nav");
      const shiftsLink = mobileMenu.getByRole("link", {
        name: "Browse Shifts",
      });
      await shiftsLink.click();

      // Wait for navigation
      await page.waitForURL("/shifts");

      // Menu should be closed (shifts link in menu should not be visible)
      // Note: There might be another "Browse Shifts" link on the page, so we check for the mobile menu specifically
      await expect(mobileMenu).not.toBeVisible();
    });

    test("should show correct menu items for authenticated users", async ({
      page,
    }) => {
      // Login as a regular user
      await loginAsVolunteer(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Open menu
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await hamburgerButton.click();

      // Should show authenticated user menu items in mobile menu
      const mobileMenu = page.locator(".lg\\:hidden nav");
      await expect(
        mobileMenu.getByRole("link", { name: "Dashboard" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "Browse Shifts" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "My Shifts" })
      ).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "My Profile" })
      ).toBeVisible();

      // Should not show login/register in mobile menu
      const loginLink = mobileMenu.getByRole("link", { name: "Login" });
      const joinLink = mobileMenu.getByRole("link", { name: "Join Us" });
      await expect(loginLink).toHaveCount(0);
      await expect(joinLink).toHaveCount(0);
    });

    test("should show admin navigation toggle for admin users", async ({ page }) => {
      // Login as an admin
      await loginAsAdmin(page);

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate to admin area to access admin sidebar
      await page.goto("/admin");
      await page.waitForLoadState("load");

      // Admin sidebar toggle should be visible on mobile for admin users
      const adminSidebarToggle = page.getByTestId("admin-sidebar-toggle");
      await expect(adminSidebarToggle).toBeVisible();

      // Admin dashboard content should be accessible on mobile
      await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
      
      // Admin can navigate using dashboard buttons on mobile
      await page.getByTestId("dashboard-manage-users-button").click();
      await expect(page).toHaveURL("/admin/users");
      
      // Admin sidebar toggle should still be visible on other admin pages
      await expect(page.getByTestId("admin-sidebar-toggle")).toBeVisible();
    });

    test("should toggle menu open and closed", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("load");

      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      const mobileMenu = page.locator(".lg\\:hidden nav");

      // Initially closed (mobile menu should not be visible)
      await expect(mobileMenu).not.toBeVisible();

      // Open menu
      await hamburgerButton.click();
      await expect(mobileMenu).toBeVisible();
      await expect(
        mobileMenu.getByRole("link", { name: "Browse Shifts" })
      ).toBeVisible();

      // Close menu
      await hamburgerButton.click();
      await expect(mobileMenu).not.toBeVisible();
    });

    test("should maintain responsiveness on tablet viewport", async ({
      page,
    }) => {
      // Set tablet viewport (iPad size)
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto("/");
      await page.waitForLoadState("load");

      // Hamburger should be visible on tablet
      const hamburgerButton = page.getByRole("button", {
        name: "Toggle mobile menu",
      });
      await expect(hamburgerButton).toBeVisible();

      // Test menu functionality
      await hamburgerButton.click();
      const mobileMenu = page.locator(".lg\\:hidden nav");
      await expect(
        mobileMenu.getByRole("link", { name: "Browse Shifts" })
      ).toBeVisible();
    });
  });
});
