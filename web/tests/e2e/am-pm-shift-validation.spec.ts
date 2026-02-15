import { test, expect } from "./base";
import {
  createTestUser,
  deleteTestUsers,
  createShift,
  deleteTestShifts,
  getShiftTypeByName,
  getUserByEmail,
  deleteSignupsByShiftIds,
} from "./helpers/test-helpers";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("AM/PM Shift Validation", () => {
  test.describe("Volunteer Signup Validation", () => {
    test("should allow volunteer to sign up for both AM and PM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test user
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin to create shifts
        await loginAsAdmin(page);

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create AM shift (10am-1pm NZT)
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 7); // 7 days in future
        const amShiftStart = new Date(shiftDate);
        amShiftStart.setHours(10, 0, 0, 0);
        const amShiftEnd = new Date(shiftDate);
        amShiftEnd.setHours(13, 0, 0, 0);

        const amShift = await createShift(page, {
          location: "Wellington",
          start: amShiftStart,
          end: amShiftEnd,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift.id);

        // Create PM shift (5pm-8pm NZT)
        const pmShiftStart = new Date(shiftDate);
        pmShiftStart.setHours(17, 0, 0, 0);
        const pmShiftEnd = new Date(shiftDate);
        pmShiftEnd.setHours(20, 0, 0, 0);

        const pmShift = await createShift(page, {
          location: "Wellington",
          start: pmShiftStart,
          end: pmShiftEnd,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift.id);

        // Now login as volunteer to test signup
        await loginAsVolunteer(page, volunteerEmail);

        // Sign up for AM shift
        const amSignupResponse = await page.request.post(
          `/api/shifts/${amShift.id}/signup`,
          {
            data: {},
          }
        );
        expect(amSignupResponse.ok()).toBeTruthy();

        // Sign up for PM shift - should succeed
        const pmSignupResponse = await page.request.post(
          `/api/shifts/${pmShift.id}/signup`,
          {
            data: {},
          }
        );
        expect(pmSignupResponse.ok()).toBeTruthy();

        const pmSignupResult = await pmSignupResponse.json();
        expect(pmSignupResult.status).toBeDefined();
        expect(["PENDING", "CONFIRMED"]).toContain(pmSignupResult.status);
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("should prevent volunteer from signing up for two AM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test user
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin to create shifts
        await loginAsAdmin(page);

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create two AM shifts on the same day
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 8); // 8 days in future

        // First AM shift (9am-12pm NZT)
        const amShift1Start = new Date(shiftDate);
        amShift1Start.setHours(9, 0, 0, 0);
        const amShift1End = new Date(shiftDate);
        amShift1End.setHours(12, 0, 0, 0);

        const amShift1 = await createShift(page, {
          location: "Wellington",
          start: amShift1Start,
          end: amShift1End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift1.id);

        // Second AM shift (1pm-3pm NZT) - still before 4pm so it's AM
        const amShift2Start = new Date(shiftDate);
        amShift2Start.setHours(13, 0, 0, 0);
        const amShift2End = new Date(shiftDate);
        amShift2End.setHours(15, 0, 0, 0);

        const amShift2 = await createShift(page, {
          location: "Wellington",
          start: amShift2Start,
          end: amShift2End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift2.id);

        // Now login as volunteer to test signup
        await loginAsVolunteer(page, volunteerEmail);

        // Sign up for first AM shift
        const signup1Response = await page.request.post(
          `/api/shifts/${amShift1.id}/signup`,
          {
            data: {},
          }
        );
        expect(signup1Response.ok()).toBeTruthy();

        // Try to sign up for second AM shift - should fail
        const signup2Response = await page.request.post(
          `/api/shifts/${amShift2.id}/signup`,
          {
            data: {},
          }
        );
        expect(signup2Response.ok()).toBeFalsy();
        expect(signup2Response.status()).toBe(400);

        const errorResult = await signup2Response.json();
        expect(errorResult.error).toContain("AM shift");
        expect(errorResult.error).toContain("one AM shift and one PM shift per day");
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("should prevent volunteer from signing up for two PM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test user
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin to create shifts
        await loginAsAdmin(page);

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create two PM shifts on the same day
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 9); // 9 days in future

        // First PM shift (4pm-7pm NZT)
        const pmShift1Start = new Date(shiftDate);
        pmShift1Start.setHours(16, 0, 0, 0);
        const pmShift1End = new Date(shiftDate);
        pmShift1End.setHours(19, 0, 0, 0);

        const pmShift1 = await createShift(page, {
          location: "Wellington",
          start: pmShift1Start,
          end: pmShift1End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift1.id);

        // Second PM shift (7:30pm-9:30pm NZT)
        const pmShift2Start = new Date(shiftDate);
        pmShift2Start.setHours(19, 30, 0, 0);
        const pmShift2End = new Date(shiftDate);
        pmShift2End.setHours(21, 30, 0, 0);

        const pmShift2 = await createShift(page, {
          location: "Wellington",
          start: pmShift2Start,
          end: pmShift2End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift2.id);

        // Now login as volunteer to test signup
        await loginAsVolunteer(page, volunteerEmail);

        // Sign up for first PM shift
        const signup1Response = await page.request.post(
          `/api/shifts/${pmShift1.id}/signup`,
          {
            data: {},
          }
        );
        expect(signup1Response.ok()).toBeTruthy();

        // Try to sign up for second PM shift - should fail
        const signup2Response = await page.request.post(
          `/api/shifts/${pmShift2.id}/signup`,
          {
            data: {},
          }
        );
        expect(signup2Response.ok()).toBeFalsy();
        expect(signup2Response.status()).toBe(400);

        const errorResult = await signup2Response.json();
        expect(errorResult.error).toContain("PM shift");
        expect(errorResult.error).toContain("one AM shift and one PM shift per day");
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });
  });

  test.describe("Admin Assignment Validation", () => {
    test("should allow admin to assign volunteer to both AM and PM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test volunteer
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin (uses quick login)
        await loginAsAdmin(page);

        // Get volunteer
        const volunteer = await getUserByEmail(page, volunteerEmail);
        if (!volunteer) {
          throw new Error("Test volunteer not found");
        }

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create AM shift (11am-2pm NZT)
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 10); // 10 days in future
        const amShiftStart = new Date(shiftDate);
        amShiftStart.setHours(11, 0, 0, 0);
        const amShiftEnd = new Date(shiftDate);
        amShiftEnd.setHours(14, 0, 0, 0);

        const amShift = await createShift(page, {
          location: "Wellington",
          start: amShiftStart,
          end: amShiftEnd,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift.id);

        // Create PM shift (6pm-9pm NZT)
        const pmShiftStart = new Date(shiftDate);
        pmShiftStart.setHours(18, 0, 0, 0);
        const pmShiftEnd = new Date(shiftDate);
        pmShiftEnd.setHours(21, 0, 0, 0);

        const pmShift = await createShift(page, {
          location: "Wellington",
          start: pmShiftStart,
          end: pmShiftEnd,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift.id);

        // Assign volunteer to AM shift
        const amAssignResponse = await page.request.post(
          `/api/admin/shifts/${amShift.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(amAssignResponse.ok()).toBeTruthy();

        // Assign volunteer to PM shift - should succeed
        const pmAssignResponse = await page.request.post(
          `/api/admin/shifts/${pmShift.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(pmAssignResponse.ok()).toBeTruthy();

        const pmAssignResult = await pmAssignResponse.json();
        expect(pmAssignResult.status).toBe("CONFIRMED");
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("should prevent admin from assigning volunteer to two AM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test volunteer
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin
        await loginAsAdmin(page);

        // Get volunteer
        const volunteer = await getUserByEmail(page, volunteerEmail);
        if (!volunteer) {
          throw new Error("Test volunteer not found");
        }

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create two AM shifts on the same day
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 11); // 11 days in future

        // First AM shift (8am-11am NZT)
        const amShift1Start = new Date(shiftDate);
        amShift1Start.setHours(8, 0, 0, 0);
        const amShift1End = new Date(shiftDate);
        amShift1End.setHours(11, 0, 0, 0);

        const amShift1 = await createShift(page, {
          location: "Wellington",
          start: amShift1Start,
          end: amShift1End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift1.id);

        // Second AM shift (12pm-3pm NZT) - still before 4pm so it's AM
        const amShift2Start = new Date(shiftDate);
        amShift2Start.setHours(12, 0, 0, 0);
        const amShift2End = new Date(shiftDate);
        amShift2End.setHours(15, 0, 0, 0);

        const amShift2 = await createShift(page, {
          location: "Wellington",
          start: amShift2Start,
          end: amShift2End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(amShift2.id);

        // Assign volunteer to first AM shift
        const assign1Response = await page.request.post(
          `/api/admin/shifts/${amShift1.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(assign1Response.ok()).toBeTruthy();

        // Try to assign volunteer to second AM shift - should fail
        const assign2Response = await page.request.post(
          `/api/admin/shifts/${amShift2.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(assign2Response.ok()).toBeFalsy();
        expect(assign2Response.status()).toBe(400);

        const errorResult = await assign2Response.json();
        expect(errorResult.error).toContain("AM shift");
        expect(errorResult.error).toContain("one AM shift and one PM shift per day");
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("should prevent admin from assigning volunteer to two PM shifts on the same day", async ({
      page,
    }) => {
      const volunteerEmail = `am-pm-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
      const shiftIds: string[] = [];

      try {
        // Create test volunteer
        await createTestUser(page, volunteerEmail, "VOLUNTEER");

        // Login as admin
        await loginAsAdmin(page);

        // Get volunteer
        const volunteer = await getUserByEmail(page, volunteerEmail);
        if (!volunteer) {
          throw new Error("Test volunteer not found");
        }

        // Get shift type
        const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
        if (!shiftType) {
          throw new Error("Kitchen Prep shift type not found");
        }

        // Create two PM shifts on the same day
        const shiftDate = new Date();
        shiftDate.setDate(shiftDate.getDate() + 12); // 12 days in future

        // First PM shift (5pm-8pm NZT)
        const pmShift1Start = new Date(shiftDate);
        pmShift1Start.setHours(17, 0, 0, 0);
        const pmShift1End = new Date(shiftDate);
        pmShift1End.setHours(20, 0, 0, 0);

        const pmShift1 = await createShift(page, {
          location: "Wellington",
          start: pmShift1Start,
          end: pmShift1End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift1.id);

        // Second PM shift (8:30pm-10:30pm NZT)
        const pmShift2Start = new Date(shiftDate);
        pmShift2Start.setHours(20, 30, 0, 0);
        const pmShift2End = new Date(shiftDate);
        pmShift2End.setHours(22, 30, 0, 0);

        const pmShift2 = await createShift(page, {
          location: "Wellington",
          start: pmShift2Start,
          end: pmShift2End,
          capacity: 5,
          shiftTypeId: shiftType.id,
        });
        shiftIds.push(pmShift2.id);

        // Assign volunteer to first PM shift
        const assign1Response = await page.request.post(
          `/api/admin/shifts/${pmShift1.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(assign1Response.ok()).toBeTruthy();

        // Try to assign volunteer to second PM shift - should fail
        const assign2Response = await page.request.post(
          `/api/admin/shifts/${pmShift2.id}/assign`,
          {
            data: {
              volunteerId: volunteer.id,
              status: "CONFIRMED",
            },
          }
        );
        expect(assign2Response.ok()).toBeFalsy();
        expect(assign2Response.status()).toBe(400);

        const errorResult = await assign2Response.json();
        expect(errorResult.error).toContain("PM shift");
        expect(errorResult.error).toContain("one AM shift and one PM shift per day");
      } finally {
        // Cleanup - ignore errors
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });
  });
});
