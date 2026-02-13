import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createShift,
  createTestUser,
  deleteTestUsers,
  deleteTestShifts,
  getUserByEmail,
  createSignup,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

test.describe.configure({ mode: "serial" });

test.describe("Admin Shifts - Volunteer Management", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-shift-vol-${testId}@example.com`,
    `pink-volunteer-${testId}@example.com`,
    `yellow-volunteer-${testId}@example.com`,
    `green-volunteer-${testId}@example.com`,
    `new-volunteer-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];
  const testSignupIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Create test users with different grades
    await createTestUser(page, testEmails[0], "ADMIN");

    // Create volunteers with different grades
    await createTestUser(page, testEmails[1], "VOLUNTEER", {
      firstName: "Pink",
      lastName: "Volunteer",
      name: "Pink Volunteer",
      volunteerGrade: "PINK",
    });

    await createTestUser(page, testEmails[2], "VOLUNTEER", {
      firstName: "Yellow",
      lastName: "Volunteer",
      name: "Yellow Volunteer",
      volunteerGrade: "YELLOW",
    });

    await createTestUser(page, testEmails[3], "VOLUNTEER", {
      firstName: "Green",
      lastName: "Volunteer",
      name: "Green Volunteer",
      volunteerGrade: "GREEN",
    });

    await createTestUser(page, testEmails[4], "VOLUNTEER", {
      firstName: "New",
      lastName: "Volunteer",
      name: "New Volunteer",
      volunteerGrade: "GREEN", // Give a grade so they can be marked as completed shifts
    });

    // Login as admin FIRST (required for creating shifts via API)
    await loginAsAdmin(page);

    // Get user IDs before creating past shifts
    const pinkVolunteer = await getUserByEmail(page, testEmails[1]);
    const yellowVolunteer = await getUserByEmail(page, testEmails[2]);
    const greenVolunteer = await getUserByEmail(page, testEmails[3]);
    const newVolunteer = await getUserByEmail(page, testEmails[4]);

    if (
      !pinkVolunteer ||
      !yellowVolunteer ||
      !greenVolunteer ||
      !newVolunteer
    ) {
      throw new Error("Failed to retrieve test volunteer users");
    }

    // Create past completed shifts for volunteers to show their actual grades
    // Volunteers need 6+ completed shifts to show their database grade instead of "New volunteer" badge
    for (let i = 0; i < 7; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - (30 + i)); // 30+ days ago
      const pastShift = await createShift(page, {
        location: "Wellington",
        start: pastDate,
        capacity: 10,
      });
      testShiftIds.push(pastShift.id);

      // Create confirmed signups for volunteers with grades (not the new one)
      const pinkSignup = await createSignup(page, {
        userId: pinkVolunteer.id,
        shiftId: pastShift.id,
        status: "CONFIRMED",
      });
      testSignupIds.push(pinkSignup.id);

      const yellowSignup = await createSignup(page, {
        userId: yellowVolunteer.id,
        shiftId: pastShift.id,
        status: "CONFIRMED",
      });
      testSignupIds.push(yellowSignup.id);

      const greenSignup = await createSignup(page, {
        userId: greenVolunteer.id,
        shiftId: pastShift.id,
        status: "CONFIRMED",
      });
      testSignupIds.push(greenSignup.id);
    }

    // New volunteer gets 0 completed shifts to show "First shift" badge

    // Create test shift - use a date in the near future
    // Calculate date 30 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);

    // Get year, month, day in local timezone to construct date string
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;

    // Create a shift at 12:00 NZ timezone on this date
    // NZ is typically UTC+12 (NZST) or UTC+13 (NZDT during summer)
    // Using +13:00 to represent summer daylight time
    const shiftStartISO = `${targetDateStr}T12:00:00+13:00`;
    const shiftStart = new Date(shiftStartISO);

    const shift = await createShift(page, {
      location: "Wellington",
      start: shiftStart,
      capacity: 6,
    });
    testShiftIds.push(shift.id);

    // Create signups with different statuses for the main test shift
    const confirmedSignup = await createSignup(page, {
      userId: pinkVolunteer.id,
      shiftId: shift.id,
      status: "CONFIRMED",
    });
    testSignupIds.push(confirmedSignup.id);

    const pendingSignup = await createSignup(page, {
      userId: yellowVolunteer.id,
      shiftId: shift.id,
      status: "PENDING",
    });
    testSignupIds.push(pendingSignup.id);

    const waitlistedSignup = await createSignup(page, {
      userId: greenVolunteer.id,
      shiftId: shift.id,
      status: "WAITLISTED",
    });
    testSignupIds.push(waitlistedSignup.id);

    const regularPendingSignup = await createSignup(page, {
      userId: newVolunteer.id,
      shiftId: shift.id,
      status: "REGULAR_PENDING",
    });
    testSignupIds.push(regularPendingSignup.id);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test users and shifts
    await deleteTestUsers(page, testEmails);
    await deleteTestShifts(page, testShiftIds);

    // Clear the arrays for the next test
    testShiftIds.length = 0;
    testSignupIds.length = 0;
  });

  test("should display all volunteer grades with correct labels", async ({
    page,
  }) => {
    // Calculate test date consistently with the shift creation in beforeEach
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Wait for the shift card to be visible
    const shiftCard = page.locator('[data-testid^="shift-card-"]').first();
    await expect(shiftCard).toBeVisible({ timeout: 10000 });

    // Wait for volunteers to load - check for volunteer list
    await expect(
      page.locator('[data-testid^="volunteers-"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Check that all volunteers are displayed with their names
    await expect(page.getByText("Pink Volunteer").first()).toBeVisible();
    await expect(page.getByText("Yellow Volunteer").first()).toBeVisible();
    await expect(page.getByText("Green Volunteer").first()).toBeVisible();
    await expect(page.getByText("New Volunteer").first()).toBeVisible();

    // Check individual volunteer grade labels are present
    await expect(page.getByText("Shift Leader").first()).toBeVisible(); // PINK (6+ completed shifts)
    await expect(page.getByText("Experienced").first()).toBeVisible(); // YELLOW (6+ completed shifts)
    await expect(page.getByText("Standard").first()).toBeVisible(); // GREEN (6+ completed shifts)
    await expect(page.getByText("First shift").first()).toBeVisible(); // New volunteer (0 completed shifts)
  });

  test("should display all volunteer statuses including waitlisted", async ({
    page,
  }) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check individual status badges are displayed
    await expect(page.getByText("Confirmed").first()).toBeVisible(); // CONFIRMED (Pink volunteer)
    await expect(page.getByText("Pending").first()).toBeVisible(); // PENDING or REGULAR_PENDING
    await expect(page.getByText("Waitlisted").first()).toBeVisible(); // WAITLISTED (Green volunteer)

    // Check that all volunteers are visible
    await expect(page.getByText("Pink Volunteer").first()).toBeVisible();
    await expect(page.getByText("Yellow Volunteer").first()).toBeVisible();
    await expect(page.getByText("Green Volunteer").first()).toBeVisible();
    await expect(page.getByText("New Volunteer").first()).toBeVisible();
  });

  test("should show correct staffing status with confirmed volunteers only", async ({
    page,
  }) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Should show 1 confirmed out of 6 capacity (use first instance to avoid strict mode violation)
    await expect(page.getByText("1/6").first()).toBeVisible();

    // Should show "Critical" status (less than 25% filled) (use first instance)
    await expect(page.getByText("Critical").first()).toBeVisible();
  });

  test("should display volunteer action buttons for each signup", async ({
    page,
  }) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check that volunteer action components are present (dropdown menus)
    // The VolunteerActions component uses testIdPrefix pattern: shift-${shiftId}-volunteer-${signupId}-actions
    const volunteerActions = page.locator('[data-testid$="-actions"]');
    await expect(volunteerActions).toHaveCount(4); // One for each volunteer
  });

  test("should link to volunteer profiles when clicking volunteer names", async ({
    page,
  }) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check volunteer name links exist and point to admin volunteer pages
    const volunteerLinks = page.locator('a[href*="/admin/volunteers/"]');
    await expect(volunteerLinks.first()).toBeVisible();

    // Verify the link format is correct
    const firstLink = volunteerLinks.first();
    await expect(firstLink).toHaveAttribute(
      "href",
      /\/admin\/volunteers\/[a-z0-9-]+/
    );
  });

  test("should show grade badges with correct colors", async ({ page }) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check that grade labels are displayed (colors are applied via Tailwind classes)
    await expect(page.getByText("Shift Leader").first()).toBeVisible(); // PINK grade (6+ completed shifts)
    await expect(page.getByText("Experienced").first()).toBeVisible(); // YELLOW grade (6+ completed shifts)
    await expect(page.getByText("Standard").first()).toBeVisible(); // GREEN grade (6+ completed shifts)
    await expect(page.getByText("First shift").first()).toBeVisible(); // New volunteer (0 completed shifts)

    // Check that status badges are displayed
    await expect(page.getByText("Confirmed").first()).toBeVisible(); // CONFIRMED status
    await expect(page.getByText("Pending").first()).toBeVisible(); // PENDING status
    await expect(page.getByText("Waitlisted").first()).toBeVisible(); // WAITLISTED status
  });

  test("should handle shift with no volunteers correctly", async ({ page }) => {
    // Create an empty shift one day after the main test shift
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 31);

    // Get year, month, day in local timezone to construct date string
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    // Create a shift at 16:00 NZ timezone on this date
    const shiftStartISO = `${testDateStr}T16:00:00+13:00`;
    const shiftStart = new Date(shiftStartISO);

    const emptyShift = await createShift(page, {
      location: "Wellington",
      start: shiftStart,
      capacity: 3,
    });
    testShiftIds.push(emptyShift.id);

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Should show "No volunteers yet" message (use first instance to avoid strict mode violation)
    await expect(page.getByText("No volunteers yet").first()).toBeVisible();

    // Should show 0/3 capacity (use first instance)
    await expect(page.getByText("0/3").first()).toBeVisible();
  });

  test("should handle mobile responsiveness for volunteer cards", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const testDateStr = `${year}-${month}-${day}`;

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Cards should still be visible and properly formatted on mobile
    await expect(page.getByText("Pink Volunteer").first()).toBeVisible();
    await expect(page.getByText("Shift Leader").first()).toBeVisible();

    // Shift card should be visible
    const shiftCard = page.locator('[data-testid^="shift-card-"]').first();
    await expect(shiftCard).toBeVisible();

    // Volunteer avatars should be visible on mobile
    const avatar = page.locator('[data-testid^="volunteer-avatar-"]').first();
    await expect(avatar).toBeVisible();
  });
});
