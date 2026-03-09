import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Admin Dashboard Page", () => {
  test.describe("Admin Authentication and Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should allow admin users to access admin dashboard", async ({
      page,
    }) => {
      await expect(page).toHaveURL("/admin");

      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();
    });

    test("should display admin role indicator", async ({ page }) => {
      await expect(page).toHaveURL("/admin");

      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
    });
  });

  test.describe("Unauthorized Access Prevention", () => {
    test("should redirect non-admin users from admin dashboard", async ({
      page,
    }) => {
      await loginAsVolunteer(page);

      await page.goto("/admin");
      await page.waitForLoadState("load");

      await expect(page).not.toHaveURL("/admin");

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(dashboard|$)/);
    });

    test("should redirect unauthenticated users to login", async ({
      context,
    }) => {
      const newContext = await context.browser()?.newContext();
      if (!newContext) throw new Error("Could not create new context");

      const newPage = await newContext.newPage();

      await newPage.goto("/admin");

      await expect(newPage).toHaveURL(/\/login/);

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
    });

    test("should display all main statistics cards", async ({ page }) => {
      // Check Total Volunteers card
      const totalUsersCard = page.getByTestId("total-users-card");
      await expect(totalUsersCard).toBeVisible();

      const totalUsersNumber = totalUsersCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(totalUsersNumber).toBeVisible();
      const totalUsersText = await totalUsersNumber.textContent();
      expect(totalUsersText).toMatch(/^\d+$/);

      // Check Upcoming Shifts card
      const totalShiftsCard = page.getByTestId("total-shifts-card");
      await expect(totalShiftsCard).toBeVisible();

      const totalShiftsNumber = totalShiftsCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(totalShiftsNumber).toBeVisible();

      // Check Recent Signups card
      const recentSignupsCard = page.getByTestId("recent-signups-card");
      await expect(recentSignupsCard).toBeVisible();

      const recentSignupsNumber = recentSignupsCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(recentSignupsNumber).toBeVisible();

      // Check This Month card
      const thisMonthCard = page.getByTestId("this-month-card");
      await expect(thisMonthCard).toBeVisible();

      const thisMonthNumber = thisMonthCard.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      await expect(thisMonthNumber).toBeVisible();
    });

    test("should display detailed statistics information", async ({ page }) => {
      // Check volunteers/admins breakdown
      const volunteersAdminsText = page.getByTestId("users-breakdown");
      await expect(volunteersAdminsText).toBeVisible();

      // Check shifts breakdown
      const shiftsBreakdownText = page.getByTestId("shifts-breakdown");
      await expect(shiftsBreakdownText).toBeVisible();

      // Check signups breakdown
      const signupsBreakdownText = page.getByTestId("signups-breakdown");
      await expect(signupsBreakdownText).toBeVisible();

      // Check monthly breakdown
      const monthlyText = page.getByTestId("monthly-signups-text");
      await expect(monthlyText).toBeVisible();

      const newUsersText = page.getByTestId("monthly-new-users-text");
      await expect(newUsersText).toBeVisible();
    });

    test("should highlight pending signups when present", async ({ page }) => {
      const pendingBadge = page.getByTestId("pending-signups-badge");

      if ((await pendingBadge.count()) > 0) {
        await expect(pendingBadge).toBeVisible();
      }
    });
  });

  test.describe("Quick Actions Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display all quick action buttons", async ({ page }) => {
      const quickActionsHeading = page.getByTestId("quick-actions-heading");
      await expect(quickActionsHeading).toBeVisible();

      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
      await expect(createShiftButton).toHaveAttribute(
        "href",
        "/admin/shifts/new"
      );

      const manageShiftsButton = page.getByTestId(
        "dashboard-manage-shifts-button"
      );
      await expect(manageShiftsButton).toBeVisible();
      await expect(manageShiftsButton).toHaveAttribute("href", "/admin/shifts");

      const manageUsersButton = page.getByTestId(
        "dashboard-manage-users-button"
      );
      await expect(manageUsersButton).toBeVisible();
      await expect(manageUsersButton).toHaveAttribute("href", "/admin/users");

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

  test.describe("Upcoming Shifts Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display upcoming shifts or no shifts message", async ({
      page,
    }) => {
      const heading = page.getByTestId("next-shift-heading");
      await expect(heading).toBeVisible();

      const hasUpcomingShifts =
        (await page.getByTestId("no-upcoming-shifts").count()) === 0;

      if (hasUpcomingShifts) {
        const viewDetailsButton = page.getByTestId("view-shift-details-button");
        await expect(viewDetailsButton).toBeVisible();

        const volunteersText = page.getByTestId("shift-volunteers-badge");
        await expect(volunteersText).toBeVisible();
      } else {
        const noShiftsMessage = page.getByTestId("no-upcoming-shifts");
        await expect(noShiftsMessage).toBeVisible();
      }
    });

    test("should navigate to shifts management when clicking view details", async ({
      page,
    }) => {
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
    });

    test("should display attention items or positive message", async ({
      page,
    }) => {
      const needsAttentionHeading = page.getByTestId("needs-attention-heading");
      await expect(needsAttentionHeading).toBeVisible();

      const hasNoIssues =
        (await page.getByTestId("good-signup-rates-message").count()) > 0;

      if (hasNoIssues) {
        const positiveMessage = page.getByTestId("good-signup-rates-message");
        await expect(positiveMessage).toBeVisible();

        const celebrationEmoji = page.getByTestId("celebration-emoji");
        await expect(celebrationEmoji).toBeVisible();
      } else {
        // There are attention items - check for any attention content
        const attentionItems = page.getByTestId("attention-items");
        await expect(attentionItems).toBeVisible();
      }
    });

    test("should show review button when shifts need attention", async ({
      page,
    }) => {
      const reviewAllButton = page.getByTestId("review-all-button");

      if ((await reviewAllButton.count()) > 0) {
        await expect(reviewAllButton).toBeVisible();
        await expect(reviewAllButton).toHaveAttribute("href", "/admin/shifts");
      }
    });

    test("should navigate to shifts management when clicking review all", async ({
      page,
    }) => {
      const reviewAllButton = page.getByTestId("review-all-button");

      if ((await reviewAllButton.count()) > 0) {
        await reviewAllButton.click();
        await expect(page).toHaveURL("/admin/shifts");
      }
    });
  });

  test.describe("Recent Activity Section", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should display recent activity section", async ({ page }) => {
      const recentSignupsHeading = page.getByTestId("recent-signups-heading");
      await expect(recentSignupsHeading).toBeVisible();

      const noSignupsMessage = page.getByTestId("no-recent-signups");
      const noSignupsCount = await noSignupsMessage.count();

      if (noSignupsCount > 0) {
        await expect(noSignupsMessage).toBeVisible();
      } else {
        const statusBadges = page.locator('[class*="badge"], .badge');
        const badgeCount = await statusBadges.count();

        const volunteerLinks = page.getByRole("link").filter({ hasText: /.*/ });
        const linkCount = await volunteerLinks.count();

        expect(badgeCount + linkCount).toBeGreaterThan(0);
      }
    });

    test("should display signup status badges correctly", async ({ page }) => {
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
    });

    test("should display location filter tabs", async ({ page }) => {
      const filterLabel = page.getByTestId("location-filter-label");
      await expect(filterLabel).toBeVisible();

      const dropdown = page.getByTestId("location-filter-all");
      await expect(dropdown).toBeVisible();

      await dropdown.click();
      const locationItems = [
        page.getByTestId("location-filter-all-option"),
        page.getByTestId("location-filter-wellington"),
        page.getByTestId("location-filter-glen-innes"),
        page.getByTestId("location-filter-onehunga"),
      ];
      for (const item of locationItems) {
        await expect(item).toBeVisible();
      }
    });

    test("should filter data when selecting a location", async ({ page }) => {
      await page
        .locator('[class*="text-2xl"][class*="font-bold"]')
        .nth(1)
        .textContent();

      await page.getByTestId("location-filter-all").click();
      await page.getByTestId("location-filter-wellington").click();

      await page.waitForLoadState("load");

      await expect(page).toHaveURL(/location=Wellington/);

      const filteredTotalShifts = await page
        .locator('[class*="text-2xl"][class*="font-bold"]')
        .nth(1)
        .textContent();
      expect(filteredTotalShifts).toBeTruthy();
    });

    test("should return to all locations when clicking All tab", async ({
      page,
    }) => {
      await page.getByTestId("location-filter-all").click();
      await page.getByTestId("location-filter-wellington").click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL(/location=Wellington/);

      await page.getByTestId("location-filter-all").click();
      await page.getByTestId("location-filter-all-option").click();

      await page.waitForURL("/admin", { timeout: 5000 });

      const currentUrl = page.url();
      expect(currentUrl).not.toContain("location=");
    });
  });

  test.describe("Loading States and Error Handling", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should handle page loading gracefully", async ({ page }) => {
      await page.goto("/admin");

      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible({ timeout: 10000 });

      const errorMessage = page.getByText(/error|failed|something went wrong/i);
      await expect(errorMessage).not.toBeVisible();
    });

    test("should display valid data in all stat cards", async ({ page }) => {
      await page.goto("/admin");
      await page.waitForLoadState("load");

      const statNumbers = page.locator(
        '[class*="text-2xl"][class*="font-bold"]'
      );
      const count = await statNumbers.count();

      // Should have exactly 4 stat cards
      expect(count).toBe(4);

      for (let i = 0; i < count; i++) {
        const statNumber = statNumbers.nth(i);
        const text = await statNumber.textContent();

        expect(text).toMatch(/^\d+$/);
        expect(text).not.toBe("NaN");
        expect(text).not.toBe("undefined");
      }
    });
  });

  test.describe("Responsive Design", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      // Check that stat cards grid is visible
      const statCards = page.locator(
        '[class*="grid-cols-1"][class*="md:grid-cols-2"]'
      );
      await expect(statCards).toBeVisible();

      const quickActionsHeading = page.getByTestId("quick-actions-heading");
      await expect(quickActionsHeading).toBeVisible();

      const createShiftButton = page.getByTestId("create-shift-button");
      await expect(createShiftButton).toBeVisible();
    });

    test("should maintain functionality on tablet viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const adminHeading = page.getByRole("heading", {
        name: /admin dashboard/i,
      });
      await expect(adminHeading).toBeVisible();

      const locationDropdown = page.getByTestId("location-filter-all");
      await expect(locationDropdown).toBeVisible();

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
    });

    test("should have proper heading hierarchy", async ({ page }) => {
      const mainHeading = page
        .locator("h1, h2")
        .filter({ hasText: /admin dashboard/i });
      await expect(mainHeading).toBeVisible();

      const headings = page.locator("h1, h2, h3, h4, h5, h6");
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(1);
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.keyboard.press("Tab");

      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const stillFocused = page.locator(":focus");
      await expect(stillFocused).toBeVisible();
    });
  });
});
