import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
} from "./helpers/test-helpers";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

test.describe.skip("Flexible Placement System", () => {
  const testId = randomUUID().slice(0, 8);
  const adminEmail = `admin-flexible-${testId}@example.com`;
  const volunteerEmail = `volunteer-flexible-${testId}@example.com`;
  const testEmails = [adminEmail, volunteerEmail];
  const testShiftIds: string[] = [];
  let flexibleShiftTypeId: string;
  let flexibleShiftId: string;
  let targetShiftId: string;
  let volunteerUserId: string;

  test.beforeAll(async () => {
    // Create test users
    await createTestUser(adminEmail, "ADMIN");
    await createTestUser(volunteerEmail, "VOLUNTEER");

    // Get volunteer user ID for notifications
    const volunteer = await prisma.user.findUnique({
      where: { email: volunteerEmail },
    });
    volunteerUserId = volunteer!.id;

    // Ensure the "Anywhere I'm Needed (PM)" shift type exists
    let flexibleShiftType = await prisma.shiftType.findUnique({
      where: { name: "Anywhere I'm Needed (PM)" },
    });

    if (!flexibleShiftType) {
      try {
        flexibleShiftType = await prisma.shiftType.create({
          data: {
            name: "Anywhere I'm Needed (PM)",
            description:
              "Flexible placement for PM shifts starting after 4:00pm - you'll be assigned to where help is most needed",
          },
        });
      } catch (error) {
        // If creation fails due to unique constraint (another test created it), fetch it again
        flexibleShiftType = await prisma.shiftType.findUnique({
          where: { name: "Anywhere I'm Needed (PM)" },
        });
        if (!flexibleShiftType) {
          throw error; // If we still can't find it, throw the original error
        }
      }
    }
    flexibleShiftTypeId = flexibleShiftType.id;

    // Create a flexible shift for tomorrow at 4:00 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0); // 4:00 PM

    const flexibleShift = await createShift({
      location: "Wellington",
      start: tomorrow,
      end: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000), // 5 hours later (9:00 PM)
      capacity: 3,
      shiftTypeId: flexibleShiftTypeId,
    });
    flexibleShiftId = flexibleShift.id;
    testShiftIds.push(flexibleShiftId);

    // Create a target shift for placement (Kitchen Service)
    const targetShift = await createShift({
      location: "Wellington",
      start: new Date(tomorrow.getTime() + 1.5 * 60 * 60 * 1000), // 5:30 PM
      end: new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000), // 9:00 PM
      capacity: 2,
      notes: "Kitchen service target shift",
    });
    targetShiftId = targetShift.id;
    testShiftIds.push(targetShiftId);
  });

  test.afterAll(async () => {
    // Clean up notifications first
    await prisma.notification.deleteMany({
      where: { userId: volunteerUserId },
    });

    // Clean up signups before deleting users (to avoid foreign key constraint)
    await prisma.signup.deleteMany({
      where: {
        shiftId: { in: testShiftIds },
      },
    });

    // Clean up shifts before deleting users
    await deleteTestShifts(testShiftIds);

    // Finally cleanup test users
    await deleteTestUsers(testEmails);
  });

  test("volunteer can sign up for 'Anywhere I'm Needed' shift and view it in My Shifts", async ({
    page,
  }) => {
    await loginAsVolunteer(page, volunteerEmail);
    await page.goto("/shifts");
    await page.waitForLoadState("load");

    // Navigate to the date with the shift we created (tomorrow)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    const formattedDate = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD format

    await page.goto(`/shifts/details?date=${formattedDate}`);
    await page.waitForLoadState("load");

    // Look for the flexible shift type
    const flexibleShiftCard = page
      .locator('[data-testid^="shift-card-"]')
      .filter({
        hasText: "Anywhere I'm Needed (PM)",
      })
      .first();

    await expect(flexibleShiftCard).toBeVisible();
    await expect(flexibleShiftCard).toContainText(
      "Flexible placement for PM shifts"
    );

    // Wait for hydration before clicking interactive elements
    await page.waitForTimeout(1000);

    // Click signup button (using text content since it's more reliable)
    const signupButton = flexibleShiftCard.getByRole("button", {
      name: /Sign Up Now|Join Waitlist/,
    });
    await expect(signupButton).toBeVisible();
    await signupButton.click();

    // Wait for dialog to appear
    const dialog = page.getByTestId("shift-signup-dialog");
    await expect(dialog).toBeVisible();

    // Click confirm signup in dialog
    const confirmButton = page.getByTestId("shift-signup-confirm-button");
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for signup to complete
    await page.waitForTimeout(2000);

    // Verify the signup was created as flexible
    const signup = await prisma.signup.findFirst({
      where: {
        user: { email: volunteerEmail },
        shift: {
          shiftType: {
            name: "Anywhere I'm Needed (PM)",
          },
        },
      },
    });

    expect(signup).toBeTruthy();
    expect(signup?.isFlexiblePlacement).toBe(true);
    expect(signup?.placedAt).toBeNull();

    // Now navigate to My Shifts page to verify it appears there
    await page.goto("/shifts/mine");
    await page.waitForLoadState("load");

    // Wait for hydration before checking for shift content
    await page.waitForTimeout(2000);

    // Should see the flexible shift (use first() to avoid strict mode violation)
    await expect(
      page.getByText("Anywhere I'm Needed (PM)").first()
    ).toBeVisible();
  });
});
