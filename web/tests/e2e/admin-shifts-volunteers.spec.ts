import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

test.describe("Admin Shifts - Volunteer Management", () => {
  const testId = randomUUID().slice(0, 8);
  const testEmails = [
    `admin-shifts-volunteers-${testId}@example.com`,
    `volunteer-pink-${testId}@example.com`,
    `volunteer-yellow-${testId}@example.com`,
    `volunteer-green-${testId}@example.com`,
    `volunteer-new-${testId}@example.com`,
  ];
  const testShiftIds: string[] = [];
  const testSignupIds: string[] = [];

  test.beforeAll(async () => {
    // Create test users with different grades
    await createTestUser(testEmails[0], "ADMIN");

    // Create volunteers with different grades
    const pinkVolunteer = await prisma.user.create({
      data: {
        email: testEmails[1],
        hashedPassword: "hashed",
        role: "VOLUNTEER",
        name: "Pink Volunteer",
        firstName: "Pink",
        lastName: "Volunteer",
        profileCompleted: true,
        volunteerGrade: "PINK",
      },
    });

    const yellowVolunteer = await prisma.user.create({
      data: {
        email: testEmails[2],
        hashedPassword: "hashed",
        role: "VOLUNTEER",
        name: "Yellow Volunteer",
        firstName: "Yellow",
        lastName: "Volunteer",
        profileCompleted: true,
        volunteerGrade: "YELLOW",
      },
    });

    const greenVolunteer = await prisma.user.create({
      data: {
        email: testEmails[3],
        hashedPassword: "hashed",
        role: "VOLUNTEER",
        name: "Green Volunteer",
        firstName: "Green",
        lastName: "Volunteer",
        profileCompleted: true,
        volunteerGrade: "GREEN",
      },
    });

    const newVolunteer = await prisma.user.create({
      data: {
        email: testEmails[4],
        hashedPassword: "hashed",
        role: "VOLUNTEER",
        name: "New Volunteer",
        firstName: "New",
        lastName: "Volunteer",
        profileCompleted: true,
        // No volunteerGrade = new volunteer
      },
    });

    // Create test shift
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const shift = await createShift({
      location: "Wellington",
      start: new Date(tomorrow.setHours(12, 0)),
      capacity: 6,
    });
    testShiftIds.push(shift.id);

    // Create signups with different statuses
    const confirmedSignup = await prisma.signup.create({
      data: {
        userId: pinkVolunteer.id,
        shiftId: shift.id,
        status: "CONFIRMED",
      },
    });
    testSignupIds.push(confirmedSignup.id);

    const pendingSignup = await prisma.signup.create({
      data: {
        userId: yellowVolunteer.id,
        shiftId: shift.id,
        status: "PENDING",
      },
    });
    testSignupIds.push(pendingSignup.id);

    const waitlistedSignup = await prisma.signup.create({
      data: {
        userId: greenVolunteer.id,
        shiftId: shift.id,
        status: "WAITLISTED",
      },
    });
    testSignupIds.push(waitlistedSignup.id);

    const regularPendingSignup = await prisma.signup.create({
      data: {
        userId: newVolunteer.id,
        shiftId: shift.id,
        status: "REGULAR_PENDING",
      },
    });
    testSignupIds.push(regularPendingSignup.id);
  });

  test.afterAll(async () => {
    // Cleanup signups first
    await prisma.signup.deleteMany({
      where: {
        id: {
          in: testSignupIds,
        },
      },
    });

    // Cleanup test users and shifts
    await deleteTestUsers(testEmails);
    await deleteTestShifts(testShiftIds);
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.skip("should display all volunteer grades with correct labels", async ({
    page,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    await page.goto(`/admin/shifts?date=${tomorrowStr}&location=Wellington`);
    await page.waitForLoadState("load");

    // Get the shift card (should be the first one)
    const shiftCard = page.locator('[data-testid^="shift-card-"]').first();
    await expect(shiftCard).toBeVisible();

    // Check grade summary badges are present
    await expect(
      shiftCard.locator('[data-testid^="grade-pink-badge-"]')
    ).toBeVisible();
    await expect(
      shiftCard.locator('[data-testid^="grade-yellow-badge-"]')
    ).toBeVisible();
    await expect(
      shiftCard.locator('[data-testid^="grade-green-badge-"]')
    ).toBeVisible();
    await expect(
      shiftCard.locator('[data-testid^="grade-new-badge-"]')
    ).toBeVisible();

    // Check individual volunteer cards show correct grade labels
    await expect(page.getByText("Shift Leader")).toBeVisible(); // PINK
    await expect(page.getByText("Experienced")).toBeVisible(); // YELLOW
    await expect(page.getByText("Standard")).toBeVisible(); // GREEN
    await expect(page.getByText("New")).toBeVisible(); // No grade
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
    // Create an empty shift
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const emptyShift = await createShift({
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
