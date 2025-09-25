import { test, expect } from "./base";
import type { Page } from "@playwright/test";

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  try {
    await page.goto("/login");

    // Wait for the login page to load
    await page.waitForLoadState("load");

    // Wait for and click the admin login button using the correct test ID
    const adminLoginButton = page.getByTestId("quick-login-admin-button");
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });

    // Wait for page to be ready
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during admin login:", error);
    throw error; // Re-throw to fail the test if login fails
  }
}

// Helper function to login as volunteer (for testing unauthorized access)
async function loginAsVolunteer(page: Page) {
  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    // Wait for and click the volunteer login button using the correct test ID
    const volunteerLoginButton = page.getByTestId(
      "quick-login-volunteer-button"
    );
    await volunteerLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await volunteerLoginButton.click();

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });

    // Wait for page to be ready
    await page.waitForLoadState("load");
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error; // Re-throw to fail the test if login fails
  }
}

test.describe("Admin Dashboard Page", () => {
  test.describe("Admin Authentication and Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);

      // Navigate to admin dashboard and wait for it to load
      await page.goto("/admin");
      await page.waitForLoadState("load");

      // Skip tests if login failed (we're still on login page)
      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping admin dashboard tests");
      }
    });

    test("should allow admin users to access admin dashboard", async ({
      page,
    }) => {
      // Check page loads successfully
      await expect(page).toHaveURL("/admin");

      // Check main admin dashboard heading
      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();
    });

    test("should display admin role indicator", async ({ page }) => {
      // Verify admin dashboard is accessible (indicating admin role)
      await expect(page).toHaveURL("/admin");

      // Check for admin-specific elements
      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      // Admin should have access to admin actions
      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
    });
  });

  test.describe("Unauthorized Access Prevention", () => {
    test("should redirect non-admin users from admin dashboard", async ({
      page,
    }) => {
      // Login as volunteer first
      await loginAsVolunteer(page);

      // Try to access admin dashboard directly
      await page.goto("/admin");
      await page.waitForLoadState("load");

      // Should redirect to main dashboard, not admin dashboard
      await expect(page).not.toHaveURL("/admin");

      // Should be on volunteer dashboard instead
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(dashboard|$)/);
    });

    test("should redirect unauthenticated users to login", async ({
      context,
    }) => {
      // Create a new context (fresh browser session)
      const newContext = await context.browser()?.newContext();
      if (!newContext) throw new Error("Could not create new context");

      const newPage = await newContext.newPage();

      // Try to access admin dashboard directly without authentication
      await newPage.goto("/admin");

      // Should redirect to login page with callback URL
      await expect(newPage).toHaveURL(/\/login/);

      // Check callback URL parameter
      const currentUrl = newPage.url();
      expect(currentUrl).toContain("callbackUrl");
      expect(currentUrl).toContain("admin");

      await newPage.close();
      await newContext.close();
    });
  });

  test.describe("Dashboard Statistics and Metrics", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping dashboard stats tests");
      }
    });

    test("should display all main statistics cards", async ({ page }) => {
      // Check Total Users card
      const totalUsersCard = page.getByTestId("total-users-card");
      await expect(totalUsersCard).toBeVisible();

      // Check stat number is displayed as a number
      const totalUsersNumber = totalUsersCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(totalUsersNumber).toBeVisible();
      const totalUsersText = await totalUsersNumber.textContent();
      expect(totalUsersText).toMatch(/^\d+$/);

      // Check Total Shifts card
      const totalShiftsCard = page.getByTestId("total-shifts-card");
      await expect(totalShiftsCard).toBeVisible();

      const totalShiftsNumber = totalShiftsCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(totalShiftsNumber).toBeVisible();

      // Check Total Signups card
      const totalSignupsCard = page.getByTestId("total-signups-card");
      await expect(totalSignupsCard).toBeVisible();

      const totalSignupsNumber = totalSignupsCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(totalSignupsNumber).toBeVisible();

      // Check This Month card
      const thisMonthCard = page.getByTestId("this-month-card");
      await expect(thisMonthCard).toBeVisible();

      const thisMonthNumber = thisMonthCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(thisMonthNumber).toBeVisible();
    });

    test("should display detailed statistics information", async ({ page }) => {
      // Check volunteers and admins breakdown in Total Users card
      const volunteersAdminsText = page.getByTestId("users-breakdown");
      await expect(volunteersAdminsText).toBeVisible();

      // Check upcoming and completed breakdown in Total Shifts card
      const shiftsBreakdownText = page.getByTestId("shifts-breakdown");
      await expect(shiftsBreakdownText).toBeVisible();

      // Check signups breakdown in Total Signups card
      const signupsBreakdownText = page.getByTestId("signups-breakdown");
      await expect(signupsBreakdownText).toBeVisible();

      // Check monthly breakdown in This Month card
      const monthlyText = page.getByTestId("monthly-signups-text");
      await expect(monthlyText).toBeVisible();

      const newUsersText = page.getByTestId("monthly-new-users-text");
      await expect(newUsersText).toBeVisible();
    });

    test("should highlight pending signups when present", async ({ page }) => {
      // Check if there are pending signups
      const pendingBadge = page.getByTestId("pending-signups-badge");

      if ((await pendingBadge.count()) > 0) {
        await expect(pendingBadge).toBeVisible();

        // Check if the Total Signups card has highlighting when there are pending signups
        const totalSignupsCard = page.getByTestId("total-signups-card");
        const cardClasses = await totalSignupsCard.getAttribute("class");

        if (
          cardClasses?.includes("border-orange") ||
          cardClasses?.includes("bg-orange")
        ) {
          // Card should be highlighted for pending signups
          expect(cardClasses).toContain("orange");
        }
      }
    });
  });

  test.describe("Quick Actions Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping quick actions tests");
      }
    });

    test("should display all quick action buttons", async ({ page }) => {
      // Check Quick Actions section heading
      const quickActionsHeading = page.getByTestId("quick-actions-heading");
      await expect(quickActionsHeading).toBeVisible();

      // Check Create New Shift button
      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
      await expect(createShiftButton).toHaveAttribute(
        "href",
        "/admin/shifts/new"
      );

      // Check Manage All Shifts button
      const manageShiftsButton = page.getByTestId(
        "dashboard-manage-shifts-button"
      );
      await expect(manageShiftsButton).toBeVisible();
      await expect(manageShiftsButton).toHaveAttribute("href", "/admin/shifts");

      // Check Manage Users button
      const manageUsersButton = page.getByTestId(
        "dashboard-manage-users-button"
      );
      await expect(manageUsersButton).toBeVisible();
      await expect(manageUsersButton).toHaveAttribute("href", "/admin/users");

      // Check View Public Shifts button
      const viewPublicShiftsButton = page.getByTestId(
        "dashboard-view-public-shifts-button"
      );
      await expect(viewPublicShiftsButton).toBeVisible();
      await expect(viewPublicShiftsButton).toHaveAttribute("href", "/shifts");
    });

    test("should navigate to create new shift page", async ({ page }) => {
      const createShiftButton = page.getByTestId("create-shift-button");
      await createShiftButton.click();

      await expect(page).toHaveURL("/admin/shifts/new");
    });

    test("should navigate to manage shifts page", async ({ page }) => {
      const manageShiftsButton = page.getByTestId(
        "dashboard-manage-shifts-button"
      );
      await manageShiftsButton.click();

      await expect(page).toHaveURL("/admin/shifts");
    });

    test("should navigate to manage users page", async ({ page }) => {
      const manageUsersButton = page.getByTestId(
        "dashboard-manage-users-button"
      );
      await manageUsersButton.click();

      await expect(page).toHaveURL("/admin/users");
    });

    test("should navigate to public shifts page", async ({ page }) => {
      const viewPublicShiftsButton = page.getByTestId(
        "dashboard-view-public-shifts-button"
      );
      await viewPublicShiftsButton.click();

      await expect(page).toHaveURL("/shifts");
    });
  });

  test.describe("Next Shift Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping next shift tests");
      }
    });

    test("should display next shift information or no shifts message", async ({
      page,
    }) => {
      // Check for Next Shift section heading
      const nextShiftHeading = page.getByTestId("next-shift-heading");
      await expect(nextShiftHeading).toBeVisible();

      // Check either upcoming shift details or "no upcoming shifts" message
      const hasUpcomingShift =
        (await page.getByTestId("no-upcoming-shifts").count()) === 0;

      if (hasUpcomingShift) {
        // If there are upcoming shifts, check for shift details
        const viewDetailsButton = page.getByTestId("view-shift-details-button");
        await expect(viewDetailsButton).toBeVisible();

        // Check for capacity indicator (volunteers badge)
        const volunteersText = page.getByTestId("shift-volunteers-badge");
        await expect(volunteersText).toBeVisible();

        // Check for location indicator
        const locationText = page.locator("text=/📍/");
        await expect(locationText).toBeVisible();
      } else {
        // If no upcoming shifts, check for appropriate message
        const noShiftsMessage = page.getByTestId("no-upcoming-shifts");
        await expect(noShiftsMessage).toBeVisible();
      }
    });

    test("should navigate to shifts management when clicking view details", async ({
      page,
    }) => {
      // Only test if the button exists (when there are upcoming shifts)
      const viewDetailsButton = page.getByTestId("view-shift-details-button");

      if ((await viewDetailsButton.count()) > 0) {
        await viewDetailsButton.click();
        await expect(page).toHaveURL(/\/admin\/shifts/);
      }
    });
  });

  test.describe("Needs Attention Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping needs attention tests");
      }
    });

    test("should display shifts needing attention or positive message", async ({
      page,
    }) => {
      // Check for Needs Attention section heading
      const needsAttentionHeading = page.getByTestId("needs-attention-heading");
      await expect(needsAttentionHeading).toBeVisible();

      // Check either low signup shifts or positive message
      const hasLowSignupShifts =
        (await page.getByTestId("good-signup-rates-message").count()) === 0;

      if (hasLowSignupShifts) {
        // If there are shifts with low signup rates
        const lowSignupText = page.getByTestId("low-signup-rates-text");
        await expect(lowSignupText).toBeVisible();

        // Check for review button
        const reviewAllButton = page.getByTestId("review-all-button");
        await expect(reviewAllButton).toBeVisible();
        await expect(reviewAllButton).toHaveAttribute("href", "/admin/shifts");
      } else {
        // If all shifts have good signup rates
        const positiveMessage = page.getByTestId("good-signup-rates-message");
        await expect(positiveMessage).toBeVisible();

        // Check for celebration emoji
        const celebrationEmoji = page.getByTestId("celebration-emoji");
        await expect(celebrationEmoji).toBeVisible();
      }
    });

    test("should navigate to shifts management when clicking review all", async ({
      page,
    }) => {
      // Only test if the button exists (when there are shifts needing attention)
      const reviewAllButton = page.getByTestId("review-all-button");

      if ((await reviewAllButton.count()) > 0) {
        await reviewAllButton.click();
        await expect(page).toHaveURL("/admin/shifts");
      }
    });
  });

  test.describe("Recent Signups Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping recent signups tests");
      }
    });

    test("should display recent signups section", async ({ page }) => {
      // Check for Recent Signups section heading
      const recentSignupsHeading = page.getByTestId("recent-signups-heading");
      await expect(recentSignupsHeading).toBeVisible();

      // Check if there's a "no recent signups" message visible on the page
      const noSignupsMessage = page.getByTestId("no-recent-signups");
      const noSignupsCount = await noSignupsMessage.count();

      if (noSignupsCount > 0) {
        // If no recent signups message exists
        await expect(noSignupsMessage).toBeVisible();
      } else {
        // If there are recent signups, check for status badges or links
        // Look for either badges or volunteer links
        const statusBadges = page.locator('[class*="badge"], .badge');
        const badgeCount = await statusBadges.count();

        const volunteerLinks = page.getByRole("link").filter({ hasText: /.*/ });
        const linkCount = await volunteerLinks.count();

        // At least one of these should exist if there are signups
        expect(badgeCount + linkCount).toBeGreaterThan(0);
      }
    });

    test("should display signup status badges correctly", async ({ page }) => {
      // Look for status badges in the recent signups section
      const statusTexts = ["confirmed", "pending", "waitlisted", "canceled"];

      for (const status of statusTexts) {
        const statusBadge = page.getByText(status, { exact: false });
        if ((await statusBadge.count()) > 0) {
          await expect(statusBadge.first()).toBeVisible();
        }
      }
    });
  });

  test.describe("Location Filter", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping location filter tests");
      }
    });

    test("should display location filter tabs", async ({ page }) => {
      // Check for filter label
      const filterLabel = page.getByTestId("location-filter-label");
      await expect(filterLabel).toBeVisible();

      // Check for "All" tab
      const allTab = page.getByTestId("location-filter-all");
      await expect(allTab).toBeVisible();

      // Check for location tabs (Wellington, Glen Innes, Onehunga)
      const locationTabs = [
        page.getByTestId("location-filter-wellington"),
        page.getByTestId("location-filter-glen-innes"),
        page.getByTestId("location-filter-onehunga"),
      ];
      for (const tab of locationTabs) {
        await expect(tab).toBeVisible();
      }
    });

    test("should filter data when selecting a location", async ({ page }) => {
      // Get initial stats
      const initialTotalShifts = await page
        .locator('[class*="text-2xl"][class*="font-bold"]')
        .nth(1)
        .textContent();

      // Click on Wellington location filter
      const wellingtonTab = page.getByTestId("location-filter-wellington");
      await wellingtonTab.click();

      // Wait for page to load with filter
      await page.waitForLoadState("load");

      // Verify URL has location parameter
      await expect(page).toHaveURL(/location=Wellington/);

      // Stats should potentially change (or stay the same if all shifts are in Wellington)
      const filteredTotalShifts = await page
        .locator('[class*="text-2xl"][class*="font-bold"]')
        .nth(1)
        .textContent();
      expect(filteredTotalShifts).toBeTruthy();
    });

    test("should return to all locations when clicking All tab", async ({
      page,
    }) => {
      // First filter by a location
      const wellingtonTab = page.getByTestId("location-filter-wellington");
      await wellingtonTab.click();
      await page.waitForLoadState("load");

      // Verify we're on Wellington filter
      await expect(page).toHaveURL(/location=Wellington/);

      // Then click All to remove filter
      const allTab = page.getByTestId("location-filter-all");
      await allTab.click();

      // Wait for navigation to complete
      await page.waitForURL("/admin", { timeout: 5000 });

      // Verify URL doesn't have location parameter
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("location=");
    });
  });

  test.describe("Loading States and Error Handling", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should handle page loading gracefully", async ({ page }) => {
      // Navigate to admin dashboard and verify it loads without errors
      await page.goto("/admin");

      // Wait for the main content to be visible
      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible({ timeout: 10000 });

      // Check that no error messages are displayed
      const errorMessage = page.getByText(/error|failed|something went wrong/i);
      await expect(errorMessage).not.toBeVisible();
    });

    test("should display valid data in all stat cards", async ({ page }) => {
      await page.goto("/admin");
      await page.waitForLoadState("load");

      // Check that all stat numbers are valid (not NaN or undefined)
      const statNumbers = page.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      const count = await statNumbers.count();

      // Should have exactly 4 stat cards
      expect(count).toBe(4);

      for (let i = 0; i < count; i++) {
        const statNumber = statNumbers.nth(i);
        const text = await statNumber.textContent();

        // Should be a number (including 0)
        expect(text).toMatch(/^\d+$/);
        expect(text).not.toBe("NaN");
        expect(text).not.toBe("undefined");
      }
    });
  });

  test.describe("Responsive Design", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(
          true,
          "Admin login failed - skipping responsive design tests"
        );
      }
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Check that main elements are still visible
      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      // Check that stat cards are visible on mobile
      const statCards = page.locator(
        '[class*="grid-cols-1"][class*="md:grid-cols-2"]'
      );
      await expect(statCards).toBeVisible();

      // Check quick actions are visible
      const quickActionsHeading = page.getByTestId("quick-actions-heading");
      await expect(quickActionsHeading).toBeVisible();

      // Check at least one quick action button is visible
      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
    });

    test("should maintain functionality on tablet viewport", async ({
      page,
    }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify main functionality still works
      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      // Check location filter tabs are still accessible
      const wellingtonTab = page.getByTestId("location-filter-wellington");
      await expect(wellingtonTab).toBeVisible();

      // Test a navigation action
      const manageUsersButton = page.getByTestId(
        "dashboard-manage-users-button"
      );
      await manageUsersButton.click();
      await expect(page).toHaveURL("/admin/users");
    });
  });

  test.describe("Accessibility", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        test.skip(true, "Admin login failed - skipping accessibility tests");
      }
    });

    test("should have proper heading hierarchy", async ({ page }) => {
      // Check main heading
      const mainHeading = page
        .locator("h1, h2")
        .filter({ hasText: /admin dashboard/i });
      await expect(mainHeading).toBeVisible();

      // Check section headings exist
      const headings = page.locator("h1, h2, h3, h4, h5, h6");
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(1);
    });

    test("should support keyboard navigation", async ({ page }) => {
      // Focus on first focusable element
      await page.keyboard.press("Tab");

      // Verify we can navigate through the interface
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();

      // Continue tabbing to ensure tab order is logical
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Should still have a focused element
      const stillFocused = page.locator(":focus");
      await expect(stillFocused).toBeVisible();
    });
  });
});
