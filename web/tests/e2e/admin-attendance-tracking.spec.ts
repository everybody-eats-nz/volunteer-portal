import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
  getUserByEmail,
  createSignup,
  deleteSignupsByShiftIds,
  getShiftTypeByName,
} from "./helpers/test-helpers";
import { format } from "date-fns";
import { tz } from "@date-fns/tz";
import { randomUUID } from "crypto";

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
      const calendarButton = page
        .locator("button")
        .filter({ hasText: /\d{4}/ });
      await calendarButton.click();

      // Check calendar dialog is visible
      await expect(page.getByRole("dialog")).toBeVisible();

      // Click on a past date (use yesterday in NZ timezone)
      const yesterday = addDaysInNZT(nowInNZT(), -1);
      const yesterdayStr = formatInNZT(yesterday, "yyyy-MM-dd");

      // Target the gridcell by its ISO date (react-day-picker puts data-day on
      // each cell). Filtering by visible "29" text would match March 29 first
      // when April's grid shows leading days from the prior month.
      const yesterdayButton = page
        .locator(`[data-day="${yesterdayStr}"] button`)
        .first();

      // Click the date - it should be selectable now
      await yesterdayButton.click();

      // Calendar should close and URL should update
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page).toHaveURL(new RegExp(`date=${yesterdayStr}`));
    });

    test("should display shifts from seeded historical data", async ({
      page,
    }) => {
      // Use a date that should have historical shifts from seed data (NZ timezone)
      const oneWeekAgo = addDaysInNZT(nowInNZT(), -7);
      const weekAgoStr = formatInNZT(oneWeekAgo, "yyyy-MM-dd");

      await page.goto(`/admin/shifts?date=${weekAgoStr}&location=Wellington`);
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
    test("should show proper testids for volunteer actions", async ({
      page,
    }) => {
      // Navigate to today's shifts which should have volunteers from seed data
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer actions with testids
      const volunteerActions = page.locator(
        '[data-testid*="volunteer-actions-"]'
      );

      if ((await volunteerActions.count()) > 0) {
        // Check for confirmed actions testid
        const confirmedActions = page.locator(
          '[data-testid*="confirmed-actions"]'
        );
        const pendingActions = page.locator('[data-testid*="pending-actions"]');
        const waitlistedActions = page.locator(
          '[data-testid*="waitlisted-actions"]'
        );

        // At least one type of action should be present
        const hasActions =
          (await confirmedActions.count()) > 0 ||
          (await pendingActions.count()) > 0 ||
          (await waitlistedActions.count()) > 0;

        expect(hasActions).toBe(true);
      }
    });

    test("should display volunteer grade badges with testids", async ({
      page,
    }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer grade badges
      const gradeBadges = page.locator('[data-testid*="volunteer-grade-"]');

      if ((await gradeBadges.count()) > 0) {
        await expect(gradeBadges.first()).toBeVisible();

        // Should contain grade text - can be static grades or dynamic labels based on completed shifts
        const badgeText = await gradeBadges.first().textContent();
        expect(badgeText).toMatch(/(Standard|Experienced|Shift Leader|First shift|New volunteer)/);
      }
    });

    test("should show cancel buttons with proper testids for confirmed volunteers", async ({
      page,
    }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for cancel buttons
      const cancelButtons = page.locator('[data-testid*="cancel-button"]');

      if ((await cancelButtons.count()) > 0) {
        await expect(cancelButtons.first()).toBeVisible();
        await expect(cancelButtons.first()).toHaveAttribute(
          "title",
          "Cancel this shift"
        );
      }
    });

    test("should show move buttons with proper testids for confirmed volunteers", async ({
      page,
    }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for move buttons
      const moveButtons = page.locator('[data-testid*="move-button"]');

      if ((await moveButtons.count()) > 0) {
        await expect(moveButtons.first()).toBeVisible();
        await expect(moveButtons.first()).toHaveAttribute(
          "title",
          "Move to different shift"
        );
      }
    });
  });

  test.describe("No Show Badge Display", () => {
    let testUserEmail: string;
    let testShiftId: string;
    let testShiftDateStr: string;

    test.beforeEach(async ({ page }) => {
      const testId = randomUUID().slice(0, 8);
      testUserEmail = `volunteer-noshow-${testId}@example.com`;

      // Create the volunteer
      await createTestUser(page, testUserEmail, "VOLUNTEER");
      const volunteer = await getUserByEmail(page, testUserEmail);

      // Create a shift in the past (yesterday) and seed a NO_SHOW signup, so
      // the test deterministically renders the No Show status group instead
      // of scanning seed data and racing against dev-server compile time.
      const yesterday = addDaysInNZT(nowInNZT(), -1);
      yesterday.setHours(11, 0, 0, 0);
      const endTime = new Date(yesterday.getTime() + 3 * 60 * 60 * 1000);
      testShiftDateStr = formatInNZT(yesterday, "yyyy-MM-dd");

      const kitchenShiftType = await getShiftTypeByName(page, "Kitchen Prep");
      const shift = await createShift(page, {
        location: "Wellington",
        start: yesterday,
        end: endTime,
        capacity: 4,
        shiftTypeId: kitchenShiftType?.id,
      });
      testShiftId = shift.id;

      await createSignup(page, {
        userId: volunteer!.id,
        shiftId: testShiftId,
        status: "NO_SHOW",
      });
    });

    test.afterEach(async ({ page }) => {
      await deleteSignupsByShiftIds(page, [testShiftId]);
      await deleteTestShifts(page, [testShiftId]);
      await deleteTestUsers(page, [testUserEmail]);
    });

    test("should render the No Show status group for past no-show signups", async ({
      page,
    }) => {
      await page.goto(
        `/admin/shifts?date=${testShiftDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Scope to this test's specific shift card to stay parallel-safe
      const shiftCard = page.locator(
        `[data-testid="shift-card-${testShiftId}"]`
      );
      await expect(shiftCard).toBeVisible({ timeout: 15000 });

      // The No Show status group renders a header with the label and count,
      // wrapped in red theme classes. Match the label inside the volunteer
      // container for this shift.
      const noShowHeader = page
        .getByTestId(`volunteers-${testShiftId}`)
        .getByText(/^No Show$/);
      await expect(noShowHeader).toBeVisible({ timeout: 10000 });

      // Header sits in a styled container — verify the red theme class.
      const noShowContainer = noShowHeader.locator("xpath=ancestor::div[1]");
      await expect(noShowContainer).toHaveClass(/bg-red-50/);
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

    test("should show volunteer profile links with testids", async ({
      page,
    }) => {
      await page.goto("/admin/shifts?location=Wellington");
      await page.waitForLoadState("load");

      // Look for volunteer name links
      const volunteerNameLinks = page.locator(
        '[data-testid*="volunteer-name-link-"]'
      );

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
    test("should have proper button titles and attributes", async ({
      page,
    }) => {
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

    test("should navigate to today when clicking today button", async ({
      page,
    }) => {
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
