import { test, expect } from "./base";
import type { Page } from "@playwright/test";
import { loginAsVolunteer } from "./helpers/auth";

// React streams the Suspense content into a hidden template div before
// hydration moves it into place, so a testid can briefly resolve to two
// elements (one hidden). Scope every page-level locator to the visible copy.
function vis(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

// Helper function to wait for page to load completely
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("load");
  // Wait for the page root element rather than an arbitrary animation buffer.
  await expect(vis(page, "my-shifts-page")).toBeVisible();
}

// Shift rows in the schedule timeline (same markup at every viewport)
function getShiftRows(page: Page) {
  return page.locator('[data-testid="shift-row"]:visible');
}

test.describe("My Shifts Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page);

    // Navigate to my shifts page
    await page.goto("/shifts/mine");
    await waitForPageLoad(page);
  });

  test.describe("Page Structure and Layout", () => {
    test("should display my shifts page with main elements", async ({
      page,
    }) => {
      // Check page loads successfully
      await expect(page).toHaveURL("/shifts/mine");

      // Check main page container
      await expect(vis(page, "my-shifts-page")).toBeVisible();

      // Check page title and description
      const pageTitle = page.getByRole("heading", { name: /my shifts/i });
      await expect(pageTitle).toBeVisible();

      const pageDescription = page
        .getByText("Your volunteer schedule and shift history")
        .locator("visible=true");
      await expect(pageDescription).toBeVisible();
    });

    test("should display stats overview cards", async ({ page }) => {
      // Check stats overview section
      await expect(vis(page, "stats-overview")).toBeVisible();

      // Check all 4 stat cells are visible
      await expect(vis(page, "completed-shifts-card")).toBeVisible();
      await expect(vis(page, "upcoming-shifts-card")).toBeVisible();
      await expect(vis(page, "this-month-shifts-card")).toBeVisible();
      await expect(vis(page, "total-hours-card")).toBeVisible();

      // Check that each cell has a numeric value
      const completedCount = await vis(
        page,
        "completed-shifts-card-count"
      ).textContent();
      const upcomingCount = await vis(
        page,
        "upcoming-shifts-card-count"
      ).textContent();
      const thisMonthCount = await vis(
        page,
        "this-month-shifts-card-count"
      ).textContent();
      const totalHoursCount = await vis(
        page,
        "total-hours-card-count"
      ).textContent();

      expect(completedCount).toMatch(/^\d+$/);
      expect(upcomingCount).toMatch(/^\d+$/);
      expect(thisMonthCount).toMatch(/^\d+$/);
      expect(totalHoursCount).toMatch(/^\d+$/);
    });

    test("should display schedule panel with month navigation", async ({
      page,
    }) => {
      // Check schedule panel is visible
      await expect(vis(page, "schedule-panel")).toBeVisible();

      // Check month title shows current month/year
      const monthTitle = vis(page, "month-title");
      await expect(monthTitle).toBeVisible();

      const titleText = await monthTitle.textContent();
      expect(titleText).toMatch(/^\w+ \d{4}$/); // Format: "Month Year"

      // Check panel eyebrow / description
      const monthDescription = vis(page, "month-description");
      await expect(monthDescription).toBeVisible();
      await expect(monthDescription).toContainText("Your volunteer schedule");

      // Check navigation section
      await expect(vis(page, "month-navigation")).toBeVisible();

      // Check navigation buttons
      await expect(vis(page, "prev-month-button")).toBeVisible();
      await expect(vis(page, "next-month-button")).toBeVisible();
    });

    test("should display the shift timeline or an empty state", async ({
      page,
    }) => {
      await expect(vis(page, "schedule-panel")).toBeVisible();

      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        // Timeline with at least one section eyebrow visible
        await expect(vis(page, "shift-list")).toBeVisible();

        const upcomingSection = vis(page, "upcoming-section");
        const pastSection = vis(page, "past-section");
        expect(
          (await upcomingSection.count()) + (await pastSection.count())
        ).toBeGreaterThan(0);

        // Each row has a date block
        const firstDate = shiftRows.first().getByTestId("shift-row-date");
        await expect(firstDate).toBeVisible();
        expect(await firstDate.textContent()).toMatch(/\d{1,2}/);
      } else {
        // Empty month state with CTA to browse shifts
        await expect(vis(page, "empty-month")).toBeVisible();

        const browseButton = vis(page, "browse-shifts-button");
        await expect(browseButton).toBeVisible();
        await expect(browseButton).toHaveAttribute("href", "/shifts");
      }
    });
  });

  test.describe("Month Navigation", () => {
    test("should navigate to previous month", async ({ page }) => {
      // Get current month from title
      const monthTitle = vis(page, "month-title");
      await monthTitle.waitFor({ state: "visible", timeout: 5000 });
      const initialTitle = await monthTitle.textContent();

      // Click previous month button
      const prevButton = vis(page, "prev-month-button");
      await expect(prevButton).toBeVisible();
      await prevButton.click();
      await page.waitForURL("/shifts/mine?*");
      await waitForPageLoad(page);

      // Check month title has changed
      const newTitle = await vis(page, "month-title").textContent();
      expect(newTitle).not.toBe(initialTitle);
    });

    test("should navigate to next month", async ({ page }) => {
      // Get current month from title
      const monthTitle = vis(page, "month-title");
      const initialTitle = await monthTitle.textContent();

      // Click next month button
      const nextButton = vis(page, "next-month-button");
      await expect(nextButton).toBeVisible();
      await nextButton.click();
      await page.waitForURL("/shifts/mine?*");
      await waitForPageLoad(page);

      // Check month title has changed
      const newTitle = await vis(page, "month-title").textContent();
      expect(newTitle).not.toBe(initialTitle);
    });

    test("should show 'Today' button when not viewing current month", async ({
      page,
    }) => {
      // Navigate to next month
      const nextButton = vis(page, "next-month-button");
      await expect(nextButton).toBeVisible();
      await nextButton.click();
      await page.waitForURL("/shifts/mine?*");
      await waitForPageLoad(page);

      // Today button should now be visible
      const todayButton = vis(page, "today-button");
      await expect(todayButton).toBeVisible();

      // Click today button to return to current month
      await expect(todayButton).toBeEnabled();
      await todayButton.click();
      await page.waitForLoadState("load");

      // Should be back to base URL
      await expect(page).toHaveURL("/shifts/mine");
    });
  });

  test.describe("Shift Timeline", () => {
    test("should show shift information on timeline rows", async ({
      page,
    }) => {
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        const firstRow = shiftRows.first();
        await expect(firstRow).toBeVisible();

        // Row should show a time range
        const rowText = await firstRow.textContent();
        expect(rowText).toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);

        // Row should show a status badge (one of the two responsive
        // placements is visible at any viewport)
        const badge = firstRow
          .locator('[data-testid="status-badge"]:visible')
          .first();
        await expect(badge).toBeVisible();
        expect(await badge.textContent()).toMatch(
          /pending|confirmed|completed|waitlisted/i
        );
      }
    });

    test("should highlight today's shift with a pill", async ({ page }) => {
      // Only present when a shift is booked today — conditional check
      const todayPill = vis(page, "today-pill");
      if ((await todayPill.count()) > 0) {
        await expect(todayPill.first()).toBeVisible();
        expect(await todayPill.first().textContent()).toMatch(/today/i);
      }
    });

    test("should show open-day chips linking to that day's shifts", async ({
      page,
    }) => {
      // Only present when preferred locations have open shifts this month
      const openDays = vis(page, "open-days");
      if ((await openDays.count()) > 0) {
        await expect(openDays).toBeVisible();

        const chips = vis(page, "open-day-chip");
        expect(await chips.count()).toBeGreaterThan(0);

        const firstChip = chips.first();
        await expect(firstChip).toBeVisible();
        expect(await firstChip.textContent()).toMatch(/available/i);

        // Chip should deep-link to that day's shift page (with the
        // location included when the day's open shifts share one)
        const href = await firstChip.getAttribute("href");
        expect(href).toMatch(
          /^\/shifts\/details\?date=\d{4}-\d{2}-\d{2}(&location=.+)?$/
        );
      }
    });
  });

  test.describe("Shift Details Dialog", () => {
    test("should open shift details when clicking on a shift", async ({
      page,
    }) => {
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        // Click on first shift
        await shiftRows.first().waitFor({ state: "visible" });
        await shiftRows.first().click();

        // Dialog should open
        const dialog = page.locator("[role='dialog']");
        await expect(dialog).toBeVisible();

        // Dialog should have title
        const dialogTitle = dialog.locator("h2, .display").first();
        await expect(dialogTitle).toBeVisible();

        // Close dialog by escape
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
      }
    });

    test("should display shift information in dialog", async ({ page }) => {
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        await shiftRows.first().click();

        const dialog = page.locator("[role='dialog']");
        await expect(dialog).toBeVisible();

        // Should show status
        const statusText = dialog.getByText(
          /pending|confirmed|completed|waitlisted/i
        );
        if ((await statusText.count()) > 0) {
          await expect(statusText.first()).toBeVisible();
        }

        // Should show time information
        const timeInfo = dialog.locator("text=/\\d{1,2}:\\d{2}\\s*(am|pm)/i");
        if ((await timeInfo.count()) > 0) {
          await expect(timeInfo.first()).toBeVisible();
        }

        await page.keyboard.press("Escape");
      }
    });

    test("should show cancel button for upcoming shifts", async ({ page }) => {
      // Open the first upcoming shift, if any
      const upcomingSection = vis(page, "upcoming-section");
      if ((await upcomingSection.count()) === 0) {
        return;
      }

      const upcomingRows = upcomingSection.getByTestId("shift-row");
      const rowCount = await upcomingRows.count();

      if (rowCount > 0) {
        await upcomingRows.first().click();

        const dialog = page.locator("[role='dialog']");
        await expect(dialog).toBeVisible();

        // Cancel button should be visible and enabled
        const cancelButton = dialog.getByTestId("cancel-shift-button");
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toBeEnabled();

        await page.keyboard.press("Escape");
      }
    });
  });

  test.describe("Friends Integration", () => {
    test("should show friends joining shifts", async ({ page }) => {
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        // Look for friend avatar chips on timeline rows
        const friendChips = vis(page, "friend-chip");
        const chipCount = await friendChips.count();

        if (chipCount > 0) {
          const firstChip = friendChips.first();
          await expect(firstChip).toBeVisible();
          expect(await firstChip.textContent()).toMatch(/join/i);

          // Shows friend avatars rather than just a count
          const avatars = firstChip.locator(
            '[data-slot="avatar"], .rounded-full'
          );
          expect(await avatars.count()).toBeGreaterThan(0);
        }
      }
    });

    test("should display friend details in shift dialog", async ({ page }) => {
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        await shiftRows.first().click();

        const dialog = page.locator("[role='dialog']");
        await expect(dialog).toBeVisible();

        // Look for friends section ("Whānau joining" / "Whānau who joined")
        const friendsSection = dialog.getByText(/whānau (joining|who joined)/i);
        if ((await friendsSection.count()) > 0) {
          await expect(friendsSection.first()).toBeVisible();

          // Should show friend avatars/names
          const friendElements = dialog.locator(
            "[data-testid*='friend'], .flex.items-center.gap-3"
          );
          if ((await friendElements.count()) > 0) {
            await expect(friendElements.first()).toBeVisible();
          }
        }

        await page.keyboard.press("Escape");
      }
    });
  });

  test.describe("Authentication and Access Control", () => {
    test("should require authentication to access my shifts page", async ({
      context,
    }) => {
      // Create a new context (fresh browser session)
      const newContext = await context.browser()?.newContext();
      if (!newContext) throw new Error("Could not create new context");

      const newPage = await newContext.newPage();

      // Try to access my shifts directly without authentication
      await newPage.goto("/shifts/mine");
      await newPage.waitForLoadState("load");

      // Should be redirected to login with callback URL
      await expect(newPage).toHaveURL(/\/login.*callbackUrl.*shifts\/mine/);

      await newPage.close();
      await newContext.close();
    });
  });

  test.describe("Responsive Design", () => {
    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForPageLoad(page);

      // Check that main elements are still visible and accessible
      await expect(vis(page, "my-shifts-page")).toBeVisible();

      // Check stats band stays visible on mobile
      await expect(vis(page, "stats-overview")).toBeVisible();

      // The timeline (or empty state) renders the same markup on mobile
      const shiftList = vis(page, "shift-list");
      const emptyMonth = vis(page, "empty-month");
      expect(
        (await shiftList.count()) + (await emptyMonth.count())
      ).toBeGreaterThan(0);

      // Check navigation buttons are accessible
      await expect(vis(page, "prev-month-button")).toBeVisible();

      // No horizontal overflow
      const hasHorizontalScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1
      );
      expect(hasHorizontalScroll).toBe(false);
    });

    test("should open shift details from a row on mobile", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await waitForPageLoad(page);

      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        await shiftRows.first().click();

        // On mobile the responsive dialog renders as a drawer — both have
        // role="dialog"
        const dialog = page.locator("[role='dialog']");
        await expect(dialog).toBeVisible();
      }
    });
  });

  test.describe("Performance and Loading", () => {
    test("should load within reasonable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/shifts/mine");
      await waitForPageLoad(page);

      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test("should display stats without errors", async ({ page }) => {
      // Check that no error messages are displayed
      const errorMessage = page.getByText(/error|failed|something went wrong/i);
      await expect(errorMessage.first()).not.toBeVisible();

      // Check that all 4 stat cells are displayed
      await expect(vis(page, "completed-shifts-card-count")).toBeVisible();
      await expect(vis(page, "upcoming-shifts-card-count")).toBeVisible();
      await expect(vis(page, "this-month-shifts-card-count")).toBeVisible();
      await expect(vis(page, "total-hours-card-count")).toBeVisible();

      // Check each stat cell's number display
      const completedCount = await vis(
        page,
        "completed-shifts-card-count"
      ).textContent();
      const upcomingCount = await vis(
        page,
        "upcoming-shifts-card-count"
      ).textContent();
      const thisMonthCount = await vis(
        page,
        "this-month-shifts-card-count"
      ).textContent();
      const totalHoursCount = await vis(
        page,
        "total-hours-card-count"
      ).textContent();

      expect(completedCount).toMatch(/^\d+$/);
      expect(upcomingCount).toMatch(/^\d+$/);
      expect(thisMonthCount).toMatch(/^\d+$/);
      expect(totalHoursCount).toMatch(/^\d+$/);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper heading hierarchy", async ({ page }) => {
      // Check main heading
      const mainHeading = page.getByRole("heading", { name: /my shifts/i });
      await expect(mainHeading).toBeVisible();

      // Check month heading inside the schedule panel
      await expect(vis(page, "month-title")).toBeVisible();
    });

    test("should have accessible navigation buttons", async ({ page }) => {
      // Navigation buttons should be proper links
      const prevButton = vis(page, "prev-month-button");
      await expect(prevButton).toBeVisible();
      await expect(prevButton).toHaveAttribute("href");

      const nextButton = vis(page, "next-month-button");
      await expect(nextButton).toBeVisible();
      await expect(nextButton).toHaveAttribute("href");

      // Today button (only visible when not viewing current month)
      await nextButton.click();
      await page.waitForURL("/shifts/mine?*");
      await waitForPageLoad(page);

      const todayButton = vis(page, "today-button");
      if (await todayButton.isVisible()) {
        await expect(todayButton).toHaveAttribute("href");
      }
    });

    test("should have accessible shift interactions", async ({ page }) => {
      // Shift rows are real buttons, so they're keyboard-focusable
      const shiftRows = getShiftRows(page);
      const rowCount = await shiftRows.count();

      if (rowCount > 0) {
        const firstRow = shiftRows.first();
        await expect(firstRow).toBeVisible();

        // Rows are <button> elements
        const tagName = await firstRow.evaluate((el) =>
          el.tagName.toLowerCase()
        );
        expect(tagName).toBe("button");

        // Should be able to interact with it
        await firstRow.click();

        // Dialog should be accessible
        const dialog = page.locator("[role='dialog']");
        if (await dialog.isVisible()) {
          await expect(dialog).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
    });
  });
});
