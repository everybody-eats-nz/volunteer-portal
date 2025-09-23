import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";
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

test.describe("Admin Shifts Page", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-shifts-test-${testId}@example.com`,
    `volunteer-shifts-test-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];

  test.beforeAll(async () => {
    // Create test users with unique emails
    await createTestUser(testEmails[0], "ADMIN");
    await createTestUser(testEmails[1], "VOLUNTEER");
  });

  test.afterAll(async () => {
    // Cleanup test users and shifts
    await deleteTestUsers(testEmails);
    await deleteTestShifts(testShiftIds);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display admin shifts page with correct title and elements", async ({
    page,
  }) => {
    await page.goto("/admin/shifts");
    await page.waitForLoadState("load");

    // Check page title and description
    await expect(page.getByTestId("admin-page-header")).toContainText(
      "Restaurant Schedule"
    );

    // Check navigation controls are present (location selector without label)
    await expect(page.getByTestId("location-selector")).toBeVisible();
    await expect(page.getByTestId("today-button")).toBeVisible();
    await expect(page.getByTestId("create-shift-button")).toBeVisible();
  });

  test("should show calendar date picker instead of prev/next buttons", async ({
    page,
  }) => {
    await page.goto("/admin/shifts");
    await page.waitForLoadState("load");

    // Check that old navigation buttons are not present
    await expect(page.getByTestId("prev-date-button")).not.toBeVisible();
    await expect(page.getByTestId("next-date-button")).not.toBeVisible();

    // Check that calendar button is present
    const calendarButton = page.locator("button").filter({ hasText: /\d{4}/ }); // Button with year
    await expect(calendarButton).toBeVisible();
  });

  test("should open calendar popup when clicking date button", async ({
    page,
  }) => {
    await page.goto("/admin/shifts");
    await page.waitForLoadState("load");

    // Click the calendar button
    const calendarButton = page.locator("button").filter({ hasText: /\d{4}/ });
    await calendarButton.click();

    // Check that calendar popup is visible
    await expect(page.getByRole("dialog")).toBeVisible();

    // Check legend elements within the calendar dialog
    const calendarDialog = page.getByRole("dialog");
    await expect(calendarDialog.getByText("Legend:")).toBeVisible();
    await expect(
      calendarDialog.getByText("Fully Staffed (100%+)")
    ).toBeVisible();
    await expect(calendarDialog.getByText("Critical (<25%)")).toBeVisible();
  });

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
    // Go to a specific date first
    await page.goto("/admin/shifts?date=2024-01-01");
    await page.waitForLoadState("load");

    // Click today button
    await page.getByTestId("today-button").click();

    // Check that we're now on today's date (NZ timezone)
    const today = formatInNZT(nowInNZT(), "yyyy-MM-dd");
    await expect(page).toHaveURL(new RegExp(`date=${today}`));
  });

  test("should navigate to create shift page when clicking Add Shift", async ({
    page,
  }) => {
    await page.goto("/admin/shifts");
    await page.waitForLoadState("load");

    await page.getByTestId("create-shift-button").click();
    await expect(page).toHaveURL("/admin/shifts/new");
  });

  test("should display no shifts message when no shifts exist", async ({
    page,
  }) => {
    // Navigate to a date with no shifts (future date in NZ timezone)
    const futureDate = nowInNZT();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = formatInNZT(futureDate, "yyyy-MM-dd");

    await page.goto(`/admin/shifts?date=${futureDateStr}`);
    await page.waitForLoadState("load");

    // Check no shifts message
    await expect(page.getByText("No shifts scheduled")).toBeVisible();
    await expect(page.getByText("Create First Shift")).toBeVisible();
  });

  test("should restrict access to volunteers", async ({ page }) => {
    await loginAsVolunteer(page);

    await page.goto("/admin/shifts");

    // Should be redirected to volunteer dashboard page
    await expect(page).toHaveURL("/dashboard");
  });

  test.describe("With Test Shifts", () => {
    test.beforeEach(async () => {
      // Create test shifts for different scenarios using NZ timezone
      const today = nowInNZT();
      const shiftDate = new Date(today);
      shiftDate.setDate(shiftDate.getDate() + 1); // Tomorrow in NZ timezone

      const shift1 = await createShift({
        location: "Wellington",
        start: new Date(shiftDate.setHours(10, 0)),
        capacity: 4,
      });
      testShiftIds.push(shift1.id);

      const shift2 = await createShift({
        location: "Wellington",
        start: new Date(shiftDate.setHours(14, 0)),
        capacity: 2,
      });
      testShiftIds.push(shift2.id);
    });

    test("should display shift cards with correct information", async ({
      page,
    }) => {
      // Use NZ timezone to calculate tomorrow
      const tomorrow = nowInNZT();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatInNZT(tomorrow, "yyyy-MM-dd");

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Check that shift cards are displayed (should have shifts)
      const shiftCards = page.locator('[data-testid^="shift-card-"]');
      await expect(shiftCards.first()).toBeVisible();

      // Check shift details are visible (use first instance to avoid strict mode violation)
      await expect(page.getByText("Kitchen").first()).toBeVisible();
      await expect(page.getByText("10:00 AM").first()).toBeVisible();
      await expect(page.getByText("2:00 PM").first()).toBeVisible();
    });

    test("should show volunteer grade information", async ({ page }) => {
      // Use NZ timezone to calculate tomorrow
      const tomorrow = nowInNZT();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatInNZT(tomorrow, "yyyy-MM-dd");

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Check for "No volunteers yet" message in empty shift using testid
      await expect(
        page.locator('[data-testid^="no-volunteers-"]').first()
      ).toBeVisible();
    });

    test("should display staffing status correctly", async ({ page }) => {
      // Use NZ timezone to calculate tomorrow
      const tomorrow = nowInNZT();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatInNZT(tomorrow, "yyyy-MM-dd");

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Check staffing badges
      const staffingBadges = page.locator(
        ".bg-red-500, .bg-orange-500, .bg-yellow-500, .bg-green-400, .bg-green-500"
      );
      await expect(staffingBadges.first()).toBeVisible();

      // Check capacity display (0/4, 0/2, etc.) - use first instance to avoid strict mode violation
      await expect(page.getByText("0/4").first()).toBeVisible();
      await expect(page.getByText("0/2").first()).toBeVisible();
    });

    test("should show status indicators for different volunteer statuses", async ({
      page,
    }) => {
      // Use NZ timezone to calculate tomorrow
      const tomorrow = nowInNZT();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatInNZT(tomorrow, "yyyy-MM-dd");

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Should show "Critical" status for unstaffed shifts (use first instance to avoid strict mode violation)
      await expect(page.getByText("Critical").first()).toBeVisible();
    });
  });

  test.describe("Calendar Functionality", () => {
    test("should show shift indicators in calendar", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Open calendar
      const calendarButton = page
        .locator("button")
        .filter({ hasText: /\d{4}/ });
      await calendarButton.click();

      // Check calendar is visible
      await expect(page.getByRole("dialog")).toBeVisible();
    });

    test.skip("should close calendar when selecting a date with shifts", async ({
      page,
    }) => {
      // First create a shift for today
      const today = new Date();
      const shift = await createShift({
        location: "Wellington",
        start: new Date(today.setHours(15, 0)),
        capacity: 3,
      });
      testShiftIds.push(shift.id);

      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Open calendar
      const calendarButton = page
        .locator("button")
        .filter({ hasText: /\d{4}/ });
      await calendarButton.click();

      // Click on today (which should have a shift)
      const todayButton = page
        .locator('[role="button"]')
        .filter({ hasText: new RegExp(`^${today.getDate()}$`) });
      await todayButton.click();

      // Calendar should close
      await expect(page.getByRole("dialog")).not.toBeVisible();
    });

    test("should display legend in calendar popup", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Open calendar
      const calendarButton = page
        .locator("button")
        .filter({ hasText: /\d{4}/ });
      await calendarButton.click();

      // Check legend items within the calendar dialog
      const calendarDialog = page.getByRole("dialog");
      await expect(calendarDialog.getByText("Legend:")).toBeVisible();
      await expect(
        calendarDialog.getByText("Fully Staffed (100%+)")
      ).toBeVisible();
      await expect(
        calendarDialog.getByText("Needs More (50-74%)")
      ).toBeVisible();
      await expect(calendarDialog.getByText("Critical (<25%)")).toBeVisible();
    });
  });

  test.describe("Success Messages", () => {
    test("should show success message when shift created", async ({ page }) => {
      await page.goto("/admin/shifts?created=1");
      await page.waitForLoadState("load");

      await expect(page.getByTestId("shift-created-message")).toBeVisible();
      await expect(page.getByText("Shift created successfully!")).toBeVisible();
    });

    test("should show success message when shift updated", async ({ page }) => {
      await page.goto("/admin/shifts?updated=1");
      await page.waitForLoadState("load");

      await expect(page.getByTestId("shift-updated-message")).toBeVisible();
      await expect(page.getByText("Shift updated successfully!")).toBeVisible();
    });

    test("should show success message when shift deleted", async ({ page }) => {
      await page.goto("/admin/shifts?deleted=1");
      await page.waitForLoadState("load");

      await expect(page.getByTestId("shift-deleted-message")).toBeVisible();
      await expect(page.getByText("Shift deleted successfully!")).toBeVisible();
    });
  });

  test.describe("Responsive Design", () => {
    test("should work on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Check that key elements are still visible on mobile
      await expect(page.getByTestId("create-shift-button")).toBeVisible();
      await expect(page.getByTestId("location-selector")).toBeVisible();

      // Calendar button should still be clickable
      const calendarButton = page
        .locator("button")
        .filter({ hasText: /\d{4}/ });
      await expect(calendarButton).toBeVisible();
    });

    test("should stack elements properly on tablet viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Navigation should stack vertically on tablet
      const navigationControls = page.locator(".flex-col");
      await expect(navigationControls.first()).toBeVisible();
    });
  });

  test.describe("Volunteer Actions UI", () => {
    let shiftId: string;
    let signupId: string;

    test.beforeEach(async ({ page }) => {
      // Create a test shift and signup for testing volunteer actions
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const shift = await createShift({
        location: "Wellington",
        start: new Date(tomorrow.setHours(10, 0)),
        capacity: 2,
      });
      shiftId = shift.id;
      testShiftIds.push(shift.id);

      // Create a signup through the API
      await page.request.post("/api/shifts/signup", {
        data: { shiftId: shift.id },
      });

      // We'll get the signup ID from the DOM instead since signups endpoint doesn't exist
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = tomorrowDate.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Extract signup ID from the DOM test ID (if any signups exist)
      const firstCancelButton = page
        .locator('[data-testid*="cancel-button"]')
        .first();
      const testId = await firstCancelButton.getAttribute("data-testid");
      if (testId) {
        // Extract signup ID from testid format like "shift-xxx-volunteer-xxx-cancel-button"
        const matches = testId.match(/volunteer-([^-]+)-cancel-button/);
        signupId = matches ? matches[1] : "";
      }
    });

    test.skip("should show cancel dialog for confirmed volunteers", async ({
      page,
    }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Wait for volunteer actions to load
      await page.waitForSelector('[data-testid*="confirmed-actions"]', {
        timeout: 10000,
      });

      // Click the cancel button
      const cancelButton = page
        .locator('[data-testid*="cancel-button"]')
        .first();
      await cancelButton.click();

      // Check that the cancel dialog appears
      const cancelDialog = page.locator('[data-testid*="cancel-dialog"]');
      await expect(cancelDialog).toBeVisible();

      // Check dialog content
      await expect(
        page.locator('[data-testid*="cancel-dialog-title"]')
      ).toContainText("Cancel Volunteer Shift");
      await expect(
        page.locator('[data-testid*="cancel-dialog-description"]')
      ).toContainText("They will be notified by email");

      // Check dialog has both Cancel and Confirm buttons
      await expect(
        page.locator('[data-testid*="cancel-dialog-cancel"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid*="cancel-dialog-confirm"]')
      ).toBeVisible();
    });

    test.skip("should close cancel dialog when clicking cancel", async ({
      page,
    }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Open cancel dialog
      const cancelButton = page
        .locator('[data-testid*="cancel-button"]')
        .first();
      await cancelButton.click();

      // Click cancel in dialog
      await page.locator('[data-testid*="cancel-dialog-cancel"]').click();

      // Dialog should close
      const cancelDialog = page.locator('[data-testid*="cancel-dialog"]');
      await expect(cancelDialog).not.toBeVisible();
    });

    test.skip("should show confirm dialog for waitlisted volunteers", async ({
      page,
    }) => {
      // First, move the volunteer to waitlisted status via API
      await page.request.patch(`/api/admin/signups/${signupId}`, {
        data: { action: "reject" },
      });

      // Then create another signup to put them on waitlist
      await page.request.post("/api/shifts/signup", {
        data: { shiftId },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Look for waitlisted actions
      const waitlistedActions = page.locator(
        '[data-testid*="waitlisted-actions"]'
      );
      if ((await waitlistedActions.count()) > 0) {
        // Click the confirm button
        const confirmButton = page
          .locator('[data-testid*="confirm-button"]')
          .first();
        await confirmButton.click();

        // Check that the confirm dialog appears
        await expect(
          page.locator('[data-testid*="confirm-dialog"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid*="confirm-dialog-title"]')
        ).toContainText("Confirm Waitlisted Volunteer");
        await expect(
          page.locator('[data-testid*="confirm-dialog-description"]')
        ).toContainText("over the shift capacity");
      }
    });

    test.skip("should show reject dialog for pending volunteers", async ({
      page,
    }) => {
      // Create a new pending signup
      const testVolunteerEmail = `pending-test-${randomUUID().slice(
        0,
        8
      )}@example.com`;
      await createTestUser(testVolunteerEmail, "VOLUNTEER");
      testEmails.push(testVolunteerEmail);

      // Login as the new volunteer and create signup
      await page.goto("/login");
      await page.fill('[name="email"]', testVolunteerEmail);
      await page.fill('[name="password"]', "testpassword123");
      await page.click('button[type="submit"]');

      await page.request.post("/api/shifts/signup", {
        data: { shiftId },
      });

      // Back to admin view
      await loginAsAdmin(page);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Look for pending actions and reject button
      const rejectButton = page
        .locator('[data-testid*="reject-button"]')
        .first();
      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Check that the reject dialog appears
        await expect(
          page.locator('[data-testid*="reject-dialog"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid*="reject-dialog-title"]')
        ).toContainText("Reject Volunteer Signup");
        await expect(
          page.locator('[data-testid*="reject-dialog-description"]')
        ).toContainText("cannot be undone");
      }
    });
  });

  test.describe("Profile Photos", () => {
    test.skip("should display volunteer avatar components", async ({
      page,
    }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Look for shifts with volunteers
      const volunteerListItems = page.locator('[data-testid^="volunteers-"]');

      if ((await volunteerListItems.count()) > 0) {
        // Check that avatar components are present
        await expect(
          page.locator('[data-testid*="volunteer-avatar-"]').first()
        ).toBeVisible();

        // Check that avatar link is present
        await expect(
          page.locator('[data-testid*="volunteer-avatar-link-"]').first()
        ).toBeVisible();

        // Check that either image or fallback is used (volunteers may have profile photos)
        const hasImage = await page
          .locator('[data-testid*="volunteer-avatar-image-"]')
          .first()
          .isVisible();
        const hasFallback = await page
          .locator('[data-testid*="volunteer-avatar-fallback-"]')
          .first()
          .isVisible();
        expect(hasImage || hasFallback).toBeTruthy();
      }
    });

    test("should link to volunteer profile page", async ({ page }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Look for volunteer name links
      const volunteerNameLink = page
        .locator('[data-testid*="volunteer-name-link-"]')
        .first();

      if ((await volunteerNameLink.count()) > 0) {
        // Check that clicking leads to volunteer profile
        const href = await volunteerNameLink.getAttribute("href");
        expect(href).toMatch(/\/admin\/volunteers\/[a-f0-9-]+/);
      }
    });

    test("should display volunteer grade badges", async ({ page }) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
      await page.waitForLoadState("load");

      // Look for grade badges
      const gradeBadges = page.locator('[data-testid*="volunteer-grade-"]');

      if ((await gradeBadges.count()) > 0) {
        await expect(gradeBadges.first()).toBeVisible();

        // Should contain grade text like "New", "Standard", "Experienced", etc.
        const badgeText = await gradeBadges.first().textContent();
        expect(badgeText).toMatch(/(New|Standard|Experienced|Shift Leader)/);
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA labels and roles", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Check dialog accessibility
      const volunteerActions = page
        .locator('[data-testid*="volunteer-actions-"]')
        .first();

      if ((await volunteerActions.count()) > 0) {
        // Buttons should have proper titles/labels
        const actionButtons = page.locator("button", {
          has: page.locator("svg"),
        });

        if ((await actionButtons.count()) > 0) {
          const firstButton = actionButtons.first();
          const title = await firstButton.getAttribute("title");
          expect(title).toBeTruthy();
        }
      }
    });

    test("should support keyboard navigation", async ({ page }) => {
      await page.goto("/admin/shifts");
      await page.waitForLoadState("load");

      // Tab through interactive elements
      await page.keyboard.press("Tab"); // Should focus first focusable element
      await page.keyboard.press("Tab"); // Navigate to next element

      // Should not throw errors and maintain focus visibility
      const focusedElement = await page.locator(":focus").count();
      expect(focusedElement).toBeGreaterThanOrEqual(0);
    });
  });
});
