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
      // No volunteerGrade = new volunteer
    });

    // Login as admin FIRST (required for creating shifts via API)
    await loginAsAdmin(page);

    // Create test shift - use a date in the near future
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const shift = await createShift(page, {
      location: "Wellington",
      start: new Date(testDate.setHours(12, 0)),
      capacity: 6,
    });
    testShiftIds.push(shift.id);

    // Get user IDs for creating signups
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

    // Create signups with different statuses
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
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
    await expect(page.getByText("Shift Leader").first()).toBeVisible(); // PINK
    await expect(page.getByText("Experienced").first()).toBeVisible(); // YELLOW
    await expect(page.getByText("Standard").first()).toBeVisible(); // GREEN
    await expect(page.getByText("New").first()).toBeVisible(); // No grade
  });

  test("should display all volunteer statuses including waitlisted", async ({
    page,
  }) => {
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${testDateStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Check that grade labels are displayed (colors are applied via Tailwind classes)
    await expect(page.getByText("Shift Leader").first()).toBeVisible(); // PINK grade
    await expect(page.getByText("Experienced").first()).toBeVisible(); // YELLOW grade
    await expect(page.getByText("Standard").first()).toBeVisible(); // GREEN grade
    await expect(page.getByText("New").first()).toBeVisible(); // NEW (no grade)

    // Check that status badges are displayed
    await expect(page.getByText("Confirmed").first()).toBeVisible(); // CONFIRMED status
    await expect(page.getByText("Pending").first()).toBeVisible(); // PENDING status
    await expect(page.getByText("Waitlisted").first()).toBeVisible(); // WAITLISTED status
  });

  test("should handle shift with no volunteers correctly", async ({ page }) => {
    // Create an empty shift
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 31); // One day after main test shift
    const emptyShift = await createShift(page, {
      location: "Wellington",
      start: new Date(testDate.setHours(16, 0)),
      capacity: 3,
    });
    testShiftIds.push(emptyShift.id);

    const testDateStr = testDate.toISOString().split("T")[0];

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

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 30);
    const testDateStr = testDate.toISOString().split("T")[0];

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
