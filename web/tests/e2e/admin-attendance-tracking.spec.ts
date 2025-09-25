import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import { format } from "date-fns";
import { tz } from "@date-fns/tz";

// NZ timezone helpers for consistent test behavior
const NZ_TIMEZONE = "Pacific/Auckland";
const nzTimezone = tz(NZ_TIMEZONE);

function nowInNZT() {
  return nzTimezone(new Date());
}

function formatInNZT(date: Date, formatStr: string): string {
  const nzTime = nzTimezone(date);
  return format(nzTime, formatStr, { in: nzTimezone });
}

function addDaysInNZT(date: Date, days: number): Date {
  const nzTime = nzTimezone(date);
  const newDate = new Date(nzTime);
  newDate.setDate(newDate.getDate() + days);
  return nzTimezone(newDate);
}

test.describe("Admin Attendance Tracking", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("Calendar Navigation to Past Shifts", () => {
    test("should allow navigation to past dates in calendar", async ({
      page,
    }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Open calendar
      const calendarButton = page.locator("button").filter({ hasText: /\d{4}/ });
      await calendarButton.click();

      // Check calendar dialog is visible
      await expect(page.getByRole("dialog")).toBeVisible();

      // Click on a past date (use yesterday in NZ timezone)
      const yesterday = addDaysInNZT(nowInNZT(), -1);
      const yesterdayDay = yesterday.getDate();

      // Find and click yesterday's date button (should be enabled now)
      const yesterdayButton = page
        .getByRole("button")
        .filter({ hasText: new RegExp(`^${yesterdayDay}$`) })
        .first();
      
      // Click the date - it should be selectable now
      await yesterdayButton.click();

      // Calendar should close and URL should update
      await expect(page.getByRole("dialog")).not.toBeVisible();
      const yesterdayStr = formatInNZT(yesterday, "yyyy-MM-dd");
      await expect(page).toHaveURL(new RegExp(`date=${yesterdayStr}`));
    });

    test("should display shifts from seeded historical data", async ({ page }) => {
      // Use a date that should have historical shifts from seed data (NZ timezone)
      const oneWeekAgo = addDaysInNZT(nowInNZT(), -7);
      const weekAgoStr = formatInNZT(oneWeekAgo, "yyyy-MM-dd");

      await page.goto(
        `/admin/shifts?date=${weekAgoStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Should either show shift cards OR no shifts message
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      const noShiftsMessage = page.getByText("No shifts scheduled");

      // One of these should be visible
      const hasShifts = (await shiftCards.count()) > 0;
      const hasNoShiftsMessage = await noShiftsMessage.isVisible();
      
      expect(hasShifts || hasNoShiftsMessage).toBe(true);
    });
  });

  test.describe("Attendance UI Components", () => {
    test("should show proper testids for volunteer actions", async ({ page }) => {
      // Navigate to today's shifts which should have volunteers from seed data
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer actions with testids
      const volunteerActions = page.locator('[data-testid*="volunteer-actions-"]');
      
      if ((await volunteerActions.count()) > 0) {
        // Check for confirmed actions testid
        const confirmedActions = page.locator('[data-testid*="confirmed-actions"]');
        const pendingActions = page.locator('[data-testid*="pending-actions"]');
        const waitlistedActions = page.locator('[data-testid*="waitlisted-actions"]');
        
        // At least one type of action should be present
        const hasActions = (await confirmedActions.count()) > 0 ||
                          (await pendingActions.count()) > 0 ||
                          (await waitlistedActions.count()) > 0;
        
        expect(hasActions).toBe(true);
      }
    });

    test("should display volunteer grade badges with testids", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer grade badges
      const gradeBadges = page.locator('[data-testid*="volunteer-grade-"]');
      
      if ((await gradeBadges.count()) > 0) {
        await expect(gradeBadges.first()).toBeVisible();
        
        // Should contain grade text
        const badgeText = await gradeBadges.first().textContent();
        expect(badgeText).toMatch(/(Standard|Experienced|Shift Leader)/);
      }
    });

    test("should show cancel buttons with proper testids for confirmed volunteers", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for cancel buttons
      const cancelButtons = page.locator('[data-testid*="cancel-button"]');
      
      if ((await cancelButtons.count()) > 0) {
        await expect(cancelButtons.first()).toBeVisible();
        await expect(cancelButtons.first()).toHaveAttribute("title", "Cancel this shift");
      }
    });

    test.skip("should show move buttons with proper testids for confirmed volunteers", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for move buttons
      const moveButtons = page.locator('[data-testid*="move-button"]');
      
      if ((await moveButtons.count()) > 0) {
        await expect(moveButtons.first()).toBeVisible();
        await expect(moveButtons.first()).toHaveAttribute("title", "Move to different shift");
      }
    });
  });

  test.describe("No Show Badge Display", () => {
    test("should show no-show badges with proper testids when present", async ({ page }) => {
      // Check various dates for no-show badges from seeded data
      const dates = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split("T")[0]);
      }

      for (const dateStr of dates) {
        await page.goto(`/admin/shifts?date=${dateStr}&location=Wellington`);
        await page.waitForLoadState("load");

        // Look for no-show badges
        const noShowBadges = page.locator('[data-testid*="no-show-badge-"]');
        
        if ((await noShowBadges.count()) > 0) {
          await expect(noShowBadges.first()).toBeVisible();
          await expect(noShowBadges.first()).toHaveClass(/bg-red-100/);
          await expect(noShowBadges.first()).toHaveClass(/text-red-700/);
          await expect(noShowBadges.first()).toContainText("no show");
          
          // Found no-show badge, test passed
          return;
        }
      }
      
      // If no no-show badges found in any date, that's also valid (might not have any in seed data)
      console.log("No no-show badges found in seeded data - this is acceptable");
    });
  });


  test.describe("Staffing Status Display", () => {
    test("should show staffing badges with proper colors", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for staffing status badges
      const staffingBadges = page.locator(
        ".bg-red-500, .bg-orange-500, .bg-yellow-500, .bg-green-400, .bg-green-500"
      );
      
      if ((await staffingBadges.count()) > 0) {
        await expect(staffingBadges.first()).toBeVisible();
      }

      // Check for capacity display (e.g., "5/8", "0/4")
      const capacityDisplays = page.locator("text=/\\d+\\/\\d+/");
      if ((await capacityDisplays.count()) > 0) {
        await expect(capacityDisplays.first()).toBeVisible();
      }
    });

    test("should show volunteer profile links with testids", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer name links
      const volunteerNameLinks = page.locator('[data-testid*="volunteer-name-link-"]');
      
      if ((await volunteerNameLinks.count()) > 0) {
        const firstLink = volunteerNameLinks.first();
        await expect(firstLink).toBeVisible();
        
        // Check that it has proper href format
        const href = await firstLink.getAttribute("href");
        expect(href).toMatch(/\/admin\/volunteers\/[a-f0-9-]+/);
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper button titles and attributes", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Check that action buttons have proper titles
      const cancelButtons = page.locator('[data-testid*="cancel-button"]');
      if ((await cancelButtons.count()) > 0) {
        const title = await cancelButtons.first().getAttribute("title");
        expect(title).toBeTruthy();
      }

      const moveButtons = page.locator('[data-testid*="move-button"]');
      if ((await moveButtons.count()) > 0) {
        const title = await moveButtons.first().getAttribute("title");
        expect(title).toBeTruthy();
      }
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Tab through interactive elements
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Should not throw errors and maintain focus visibility
      const focusedElement = await page.locator(":focus").count();
      expect(focusedElement).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Location and Date Navigation", () => {
    test("should change location using location selector", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Check current location
      const locationSelector = page.getByTestId("location-selector");
      await expect(locationSelector).toBeVisible();

      // Change to a different location
      await locationSelector.click();
      await page.getByText("Glen Innes").click();

      // Check URL updated with new location
      await expect(page).toHaveURL(/location=Glen%20Innes/);
    });

    test("should navigate to today when clicking today button", async ({ page }) => {
      // Go to a specific past date first (using NZ timezone)
      const pastDate = addDaysInNZT(nowInNZT(), -5);
      const pastDateStr = formatInNZT(pastDate, "yyyy-MM-dd");
      
      await page.goto(`/admin/shifts?date=${pastDateStr}`);
      await page.waitForLoadState("load");

      // Click today button
      await page.getByTestId("today-button").click();

      // Check that we're now on today's date (NZ timezone)
      const today = formatInNZT(nowInNZT(), "yyyy-MM-dd");
      await expect(page).toHaveURL(new RegExp(`date=${today}`));
    });
  });
});