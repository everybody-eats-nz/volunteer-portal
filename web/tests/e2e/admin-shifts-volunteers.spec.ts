import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  createTestUser,
  deleteTestUsers,
  deleteTestShifts,
  getUserByEmail,
  createSignup,
  deleteSignupsByShiftIds,
  getShiftTypeByName,
} from "./helpers/test-helpers";

test.describe("Admin Shifts - Volunteer Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should display all volunteer grades with correct labels", async ({
    page,
  }) => {
    const testEmails = [
      "pink-volunteer-test@example.com",
      "yellow-volunteer-test@example.com",
      "green-volunteer-test@example.com",
      "new-volunteer-test@example.com",
    ];
    const testShiftIds: string[] = [];

    try {
      // Create volunteers with different grades
      await createTestUser(page, testEmails[0], "VOLUNTEER", {
        firstName: "Pink",
        lastName: "Volunteer",
        name: "Pink Volunteer",
        volunteerGrade: "PINK",
      });

      await createTestUser(page, testEmails[1], "VOLUNTEER", {
        firstName: "Yellow",
        lastName: "Volunteer",
        name: "Yellow Volunteer",
        volunteerGrade: "YELLOW",
      });

      await createTestUser(page, testEmails[2], "VOLUNTEER", {
        firstName: "Green",
        lastName: "Volunteer",
        name: "Green Volunteer",
        volunteerGrade: "GREEN",
      });

      await createTestUser(page, testEmails[3], "VOLUNTEER", {
        firstName: "New",
        lastName: "Volunteer",
        name: "New Volunteer",
        // No volunteerGrade = new volunteer
      });

      // Get user IDs
      const pinkVolunteer = await getUserByEmail(page, testEmails[0]);
      const yellowVolunteer = await getUserByEmail(page, testEmails[1]);
      const greenVolunteer = await getUserByEmail(page, testEmails[2]);
      const newVolunteer = await getUserByEmail(page, testEmails[3]);

      if (
        !pinkVolunteer ||
        !yellowVolunteer ||
        !greenVolunteer ||
        !newVolunteer
      ) {
        throw new Error("Failed to create test volunteers");
      }

      // Get a shift type
      const shiftType = await getShiftTypeByName(page, "Kitchen");
      if (!shiftType) {
        throw new Error("Failed to get shift type");
      }

      // Create test shift for 14 days from now at 12pm to avoid conflicts with existing shifts
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      futureDate.setHours(12, 0, 0, 0);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const shift = await createShift(page, {
        location: "Wellington",
        start: futureDate,
        capacity: 6,
        shiftTypeId: shiftType.id,
      });
      console.log(
        `Created shift with ID: ${shift.id} for date: ${futureDateStr}`
      );
      testShiftIds.push(shift.id);

      // Create signups with different statuses
      await createSignup(page, {
        userId: pinkVolunteer.id,
        shiftId: shift.id,
        status: "CONFIRMED",
      });

      await createSignup(page, {
        userId: yellowVolunteer.id,
        shiftId: shift.id,
        status: "PENDING",
      });

      await createSignup(page, {
        userId: greenVolunteer.id,
        shiftId: shift.id,
        status: "WAITLISTED",
      });

      await createSignup(page, {
        userId: newVolunteer.id,
        shiftId: shift.id,
        status: "REGULAR_PENDING",
      });

      // Now run the actual test
      await page.goto(
        `/admin/shifts?date=${futureDateStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Reload to ensure database changes are reflected
      await page.reload({ waitUntil: "load" });

      // Wait a moment for any animations
      await page.waitForTimeout(1000);

      // Wait for the shift card to be visible
      const shiftCard = page.locator('[data-testid^="shift-card-"]').first();
      await expect(shiftCard).toBeVisible({ timeout: 10000 });

      // Wait for volunteers to load - check for volunteer list
      await expect(
        page.locator('[data-testid^="volunteers-"]').first()
      ).toBeVisible({ timeout: 10000 });

      // Debug: Check what volunteers are actually showing
      const volunteerLinks = page.locator(
        '[data-testid^="volunteer-name-link-"]'
      );
      const count = await volunteerLinks.count();
      console.log(`Found ${count} volunteer links`);

      // Print the text content of each volunteer link
      for (let i = 0; i < count; i++) {
        const text = await volunteerLinks.nth(i).textContent();
        console.log(`Volunteer ${i}: ${text}`);
      }

      // Check that all 4 volunteers are visible with their names
      await expect(
        page.locator('[data-testid^="volunteer-name-link-"]')
      ).toHaveCount(4);
      await expect(page.getByText("Pink Volunteer")).toBeVisible();
      await expect(page.getByText("Yellow Volunteer")).toBeVisible();
      await expect(page.getByText("Green Volunteer")).toBeVisible();
      await expect(page.getByText("New Volunteer")).toBeVisible();

      // Check individual volunteer grade labels are displayed correctly
      await expect(page.getByText("Shift Leader")).toBeVisible(); // PINK
      await expect(page.getByText("Experienced")).toBeVisible(); // YELLOW
      await expect(page.getByText("Standard")).toBeVisible(); // GREEN

      // Verify the shift shows correct capacity (1 confirmed out of 6)
      await expect(page.getByText("1/6").first()).toBeVisible();
    } finally {
      // Cleanup: delete signups, users, and shifts
      await deleteSignupsByShiftIds(page, testShiftIds);
      await deleteTestUsers(page, testEmails);
      await deleteTestShifts(page, testShiftIds);
    }
  });

  test.skip("should display all volunteer statuses including waitlisted", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check status badges in grade summary bar
    await expect(page.getByText("2 pending")).toBeVisible(); // PENDING + REGULAR_PENDING
    await expect(page.getByText("1 waitlisted")).toBeVisible(); // WAITLISTED

    // Check that all volunteers are visible (no "+X more" message)
    await expect(page.getByText("Pink Volunteer")).toBeVisible();
    await expect(page.getByText("Yellow Volunteer")).toBeVisible();
    await expect(page.getByText("Green Volunteer")).toBeVisible();
    await expect(page.getByText("New Volunteer")).toBeVisible();

    // Verify no "more volunteers" message
    await expect(page.getByText(/\+\d+ more/)).not.toBeVisible();
  });

  test.skip("should show correct staffing status with confirmed volunteers only", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Should show 1 confirmed out of 6 capacity (use first instance to avoid strict mode violation)
    await expect(page.getByText("1/6").first()).toBeVisible();

    // Should show "Critical" status (less than 25% filled) (use first instance)
    await expect(page.getByText("Critical").first()).toBeVisible();
  });

  test.skip("should display volunteer action buttons for each signup", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check that volunteer action components are present (dropdown menus)
    const volunteerActions = page.locator('[data-testid*="volunteer-actions"]');
    await expect(volunteerActions).toHaveCount(4); // One for each volunteer
  });

  test.skip("should link to volunteer profiles when clicking volunteer names", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Click on a volunteer name link
    const volunteerLink = page.getByText("Pink Volunteer").locator("..");
    await expect(volunteerLink).toHaveAttribute(
      "href",
      /\/admin\/volunteers\/[a-z0-9]+/
    );
  });

  test.skip("should show grade summary badges with correct colors", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check grade badge colors (based on Tailwind classes)
    await expect(page.locator(".bg-pink-100.text-pink-700")).toBeVisible(); // PINK
    await expect(page.locator(".bg-yellow-100.text-yellow-700")).toBeVisible(); // YELLOW
    await expect(page.locator(".bg-green-100.text-green-700")).toBeVisible(); // GREEN
    await expect(page.locator(".bg-blue-100.text-blue-700")).toBeVisible(); // NEW

    // Check status badge colors
    await expect(page.locator(".bg-orange-100.text-orange-700")).toBeVisible(); // PENDING
    await expect(page.locator(".bg-purple-100.text-purple-700")).toBeVisible(); // WAITLISTED
  });

  test.skip("should handle shift with no volunteers correctly", async ({
    page,
  }) => {
    const testShiftIds: string[] = [];

    try {
      // Create an empty shift
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const emptyShift = await createShift(page, {
        location: "Wellington",
        start: new Date(tomorrow.setHours(16, 0)),
        capacity: 3,
      });
      testShiftIds.push(emptyShift.id);

      const dayAfterTomorrowStr = tomorrow.toISOString().split("T")[0];

      await page.goto(
        `/admin/shifts?date=${dayAfterTomorrowStr}&location=Wellington`
      );
      await page.waitForLoadState("load");

      // Should show "No volunteers yet" message (use first instance to avoid strict mode violation)
      await expect(page.getByText("No volunteers yet").first()).toBeVisible();
      await expect(
        page.getByText("Click to manage this shift").first()
      ).toBeVisible();

      // Should show 0/3 capacity (use first instance)
      await expect(page.getByText("0/3").first()).toBeVisible();
    } finally {
      // Cleanup
      await deleteTestShifts(page, testShiftIds);
    }
  });

  test.skip("should display volunteer avatars with initials", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check that avatar circles with initials are visible
    await expect(page.getByText("P")).toBeVisible(); // Pink Volunteer
    await expect(page.getByText("Y")).toBeVisible(); // Yellow Volunteer
    await expect(page.getByText("G")).toBeVisible(); // Green Volunteer
    await expect(page.getByText("N")).toBeVisible(); // New Volunteer
  });

  test.skip("should show all volunteers without truncation", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // All 4 volunteers should be visible
    const volunteerCards = page.locator('a[href*="/admin/volunteers/"]');
    await expect(volunteerCards).toHaveCount(4);

    // No truncation message should exist
    await expect(page.getByText(/more volunteers/)).not.toBeVisible();
    await expect(page.getByText(/^\+\d+/)).not.toBeVisible();
  });

  test.skip("should handle mobile responsiveness for volunteer cards", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Cards should still be visible and properly formatted on mobile (use first instance)
    await expect(page.getByText("Pink Volunteer").first()).toBeVisible();
    await expect(page.getByText("Shift Leader").first()).toBeVisible();

    // Grade summary badges should wrap properly
    const gradeBadges = page.locator(".flex-wrap").first();
    await expect(gradeBadges).toBeVisible();
  });
});
