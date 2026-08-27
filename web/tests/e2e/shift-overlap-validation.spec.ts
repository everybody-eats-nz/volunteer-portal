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

/**
 * Volunteers may hold several shifts on one day; only a genuine time clash is
 * refused. This replaced a Day/Evening bucket rule that also blocked
 * non-overlapping shifts, which volunteers reported as a bug.
 */
test.describe("Shift overlap validation", () => {
  const uniqueEmail = () =>
    `overlap-vol-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

  /** Builds shifts on a common day N days out, from NZ-local hour pairs. */
  async function createShiftsOnOneDay(
    page: Parameters<typeof createShift>[0],
    spans: Array<[startHour: number, startMin: number, endHour: number, endMin: number]>
  ) {
    const shiftType = await getShiftTypeByName(page, "Kitchen Prep");
    if (!shiftType) {
      throw new Error("Kitchen Prep shift type not found");
    }

    const day = new Date();
    day.setDate(day.getDate() + 7);

    const shifts = [];
    for (const [sh, sm, eh, em] of spans) {
      const start = new Date(day);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(day);
      end.setHours(eh, em, 0, 0);
      shifts.push(
        await createShift(page, {
          location: "Wellington",
          start,
          end,
          capacity: 5,
          shiftTypeId: shiftType.id,
        })
      );
    }
    return shifts;
  }

  test.describe("Volunteer signup", () => {
    test("allows two shifts on the same day when the times do not clash", async ({
      page,
    }) => {
      const volunteerEmail = uniqueEmail();
      const shiftIds: string[] = [];

      try {
        await createTestUser(page, volunteerEmail, "VOLUNTEER");
        await loginAsAdmin(page);

        // Both sit before 4pm, so the old Day/Evening rule refused the second.
        const [first, second] = await createShiftsOnOneDay(page, [
          [11, 30, 14, 30],
          [15, 0, 18, 0],
        ]);
        shiftIds.push(first.id, second.id);

        await loginAsVolunteer(page, volunteerEmail);

        const firstResponse = await page.request.post(
          `/api/shifts/${first.id}/signup`,
          { data: {} }
        );
        expect(firstResponse.ok()).toBeTruthy();

        const secondResponse = await page.request.post(
          `/api/shifts/${second.id}/signup`,
          { data: {} }
        );
        expect(secondResponse.ok()).toBeTruthy();

        const result = await secondResponse.json();
        expect(["PENDING", "CONFIRMED"]).toContain(result.status);
      } finally {
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("allows a shift starting exactly when another ends", async ({ page }) => {
      const volunteerEmail = uniqueEmail();
      const shiftIds: string[] = [];

      try {
        await createTestUser(page, volunteerEmail, "VOLUNTEER");
        await loginAsAdmin(page);

        const [first, second] = await createShiftsOnOneDay(page, [
          [10, 0, 13, 0],
          [13, 0, 16, 0],
        ]);
        shiftIds.push(first.id, second.id);

        await loginAsVolunteer(page, volunteerEmail);

        const firstResponse = await page.request.post(
          `/api/shifts/${first.id}/signup`,
          { data: {} }
        );
        expect(firstResponse.ok()).toBeTruthy();

        const secondResponse = await page.request.post(
          `/api/shifts/${second.id}/signup`,
          { data: {} }
        );
        expect(secondResponse.ok()).toBeTruthy();
      } finally {
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("refuses a shift that overlaps one the volunteer already holds", async ({
      page,
    }) => {
      const volunteerEmail = uniqueEmail();
      const shiftIds: string[] = [];

      try {
        await createTestUser(page, volunteerEmail, "VOLUNTEER");
        await loginAsAdmin(page);

        const [first, overlapping] = await createShiftsOnOneDay(page, [
          [10, 0, 14, 0],
          [13, 0, 17, 0],
        ]);
        shiftIds.push(first.id, overlapping.id);

        await loginAsVolunteer(page, volunteerEmail);

        const firstResponse = await page.request.post(
          `/api/shifts/${first.id}/signup`,
          { data: {} }
        );
        expect(firstResponse.ok()).toBeTruthy();

        const clashResponse = await page.request.post(
          `/api/shifts/${overlapping.id}/signup`,
          { data: {} }
        );
        expect(clashResponse.ok()).toBeFalsy();
        expect(clashResponse.status()).toBe(400);

        const errorResult = await clashResponse.json();
        expect(errorResult.error).toContain("overlaps this one");
        expect(errorResult.error).toContain(
          "as long as the times don't clash"
        );
        // The rule is no longer period-based, so the copy must not say it is.
        expect(errorResult.error).not.toMatch(/\bAM shift\b|\bPM shift\b/);
      } finally {
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });
  });

  test.describe("Admin assignment", () => {
    test("allows assigning a volunteer to two non-clashing shifts on one day", async ({
      page,
    }) => {
      const volunteerEmail = uniqueEmail();
      const shiftIds: string[] = [];

      try {
        await createTestUser(page, volunteerEmail, "VOLUNTEER");
        await loginAsAdmin(page);

        const volunteer = await getUserByEmail(page, volunteerEmail);
        if (!volunteer) {
          throw new Error("Test volunteer not found");
        }

        const [first, second] = await createShiftsOnOneDay(page, [
          [11, 30, 14, 30],
          [15, 0, 18, 0],
        ]);
        shiftIds.push(first.id, second.id);

        for (const shift of [first, second]) {
          const response = await page.request.post(
            `/api/admin/shifts/${shift.id}/assign`,
            { data: { volunteerId: volunteer.id, status: "CONFIRMED" } }
          );
          expect(response.ok()).toBeTruthy();
        }
      } finally {
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });

    test("refuses assigning a volunteer to an overlapping shift", async ({
      page,
    }) => {
      const volunteerEmail = uniqueEmail();
      const shiftIds: string[] = [];

      try {
        await createTestUser(page, volunteerEmail, "VOLUNTEER");
        await loginAsAdmin(page);

        const volunteer = await getUserByEmail(page, volunteerEmail);
        if (!volunteer) {
          throw new Error("Test volunteer not found");
        }

        const [first, overlapping] = await createShiftsOnOneDay(page, [
          [10, 0, 14, 0],
          [13, 0, 17, 0],
        ]);
        shiftIds.push(first.id, overlapping.id);

        const assignFirst = await page.request.post(
          `/api/admin/shifts/${first.id}/assign`,
          { data: { volunteerId: volunteer.id, status: "CONFIRMED" } }
        );
        expect(assignFirst.ok()).toBeTruthy();

        const assignClash = await page.request.post(
          `/api/admin/shifts/${overlapping.id}/assign`,
          { data: { volunteerId: volunteer.id, status: "CONFIRMED" } }
        );
        expect(assignClash.ok()).toBeFalsy();
        expect(assignClash.status()).toBe(400);

        const errorResult = await assignClash.json();
        expect(errorResult.error).toContain("overlaps this one");
        expect(errorResult.error).toContain("not at the same time");
      } finally {
        try { await deleteSignupsByShiftIds(page, shiftIds); } catch {}
        try { await deleteTestShifts(page, shiftIds); } catch {}
        try { await deleteTestUsers(page, [volunteerEmail]); } catch {}
      }
    });
  });
});
