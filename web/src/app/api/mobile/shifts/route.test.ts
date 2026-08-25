import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

// Mock dependencies before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    signup: { findMany: vi.fn(), groupBy: vi.fn() },
    shift: { findMany: vi.fn() },
    friendship: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/live-locations", () => ({
  getLiveLocations: vi.fn().mockResolvedValue([]),
}));

import { GET } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  signup: {
    findMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  shift: { findMany: ReturnType<typeof vi.fn> };
  friendship: { findMany: ReturnType<typeof vi.fn> };
};

// Freeze "now" so the in-progress window is deterministic.
const NOW = new Date("2026-07-15T19:29:00Z");

/** A shift the signed-up user is on: 5:30pm–9:30pm, currently in progress at NOW. */
function makeSignup(
  id: string,
  start: Date,
  end: Date,
  status = "CONFIRMED"
) {
  return {
    id: `signup-${id}`,
    status,
    shift: {
      id: `shift-${id}`,
      start,
      end,
      location: "Onehunga",
      capacity: 10,
      notes: null,
      shiftType: {
        id: "st-1",
        name: "Kitchen Service & Pack Down",
        description: "Evening service",
      },
      _count: { signups: 3, placeholders: 0 },
    },
  };
}

function makeRequest(query = "") {
  return new Request(`http://localhost/api/mobile/shifts${query}`, {
    method: "GET",
    headers: { Authorization: "Bearer valid-token" },
  });
}

/** Routes each signup.findMany call to the right canned result. */
function stubSignupQueries({
  mine = [] as unknown[],
  past = [] as unknown[],
  visible = [] as unknown[],
} = {}) {
  mockPrisma.signup.findMany.mockImplementation(
    (args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as {
        status?: { in?: string[] };
        shift?: { end?: { lt?: Date } };
        shiftId?: unknown;
      };
      if (where.shiftId) return Promise.resolve(visible);
      if (where.shift?.end?.lt) return Promise.resolve(past);
      if (where.status?.in?.includes("PENDING")) return Promise.resolve(mine);
      return Promise.resolve([]);
    }
  );
}

describe("GET /api/mobile/shifts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ defaultLocation: "Onehunga" });
    mockPrisma.shift.findMany.mockResolvedValue([]); // no available shifts
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    // Waitlist sizes for the shifts in the response — none waiting by default.
    mockPrisma.signup.groupBy.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes an in-progress shift (started but not yet ended) in myShifts", async () => {
    // Shift started at 5:30pm, ends 9:30pm; NOW (7:29pm) is mid-shift.
    const inProgress = makeSignup(
      "in-progress",
      new Date("2026-07-15T17:30:00Z"),
      new Date("2026-07-15T21:30:00Z")
    );

    mockPrisma.signup.findMany.mockImplementation((args?: { where?: Record<string, unknown> }) => {
      const where = (args?.where ?? {}) as {
        status?: { in?: string[] };
        shift?: { end?: { lt?: Date } };
        shiftId?: unknown;
      };
      // visibleSignups (friends) query: filters by shiftId
      if (where.shiftId) {
        return Promise.resolve([]);
      }
      // pastSignups query: filters on shift.end < now
      if (where.shift?.end?.lt) {
        return Promise.resolve([]);
      }
      // mySignups query: active statuses include PENDING, keyed on end >= now
      if (where.status?.in?.includes("PENDING")) {
        return Promise.resolve([inProgress]);
      }
      return Promise.resolve([]);
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.myShifts).toHaveLength(1);
    expect(json.myShifts[0].id).toBe("shift-in-progress");
    expect(json.past).toHaveLength(0);
  });

  it("returns each upcoming shift's waitlist size", async () => {
    // A volunteer holding a waitlist place needs to see how many others are
    // waiting without opening the shift.
    const waitlisted = makeSignup(
      "waitlisted",
      new Date("2026-07-16T17:30:00Z"),
      new Date("2026-07-16T21:30:00Z")
    );

    mockPrisma.signup.findMany.mockImplementation(
      (args?: { where?: Record<string, unknown> }) => {
        const where = (args?.where ?? {}) as {
          status?: { in?: string[] };
          shift?: { end?: { lt?: Date } };
          shiftId?: unknown;
        };
        if (where.shiftId || where.shift?.end?.lt) return Promise.resolve([]);
        if (where.status?.in?.includes("PENDING")) {
          return Promise.resolve([waitlisted]);
        }
        return Promise.resolve([]);
      }
    );
    mockPrisma.signup.groupBy.mockResolvedValue([
      { shiftId: "shift-waitlisted", _count: { _all: 7 } },
    ]);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(json.myShifts[0].waitlistCount).toBe(7);
    // Only waitlisted signups are counted, and only for shifts in the response.
    expect(mockPrisma.signup.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { shiftId: { in: ["shift-waitlisted"] }, status: "WAITLISTED" },
      })
    );
  });

  it("buckets myShifts by shift.end >= now, not shift.start", async () => {
    mockPrisma.signup.findMany.mockResolvedValue([]);

    await GET(makeRequest());

    // The first signup.findMany call is the myShifts query.
    const myShiftsCall = mockPrisma.signup.findMany.mock.calls.find(
      (call) => call[0]?.where?.status?.in?.includes("PENDING")
    );
    expect(myShiftsCall).toBeDefined();
    // Regression guard: must filter on end (keeps in-progress shifts), not start.
    expect(myShiftsCall![0].where.shift).toEqual({ end: { gte: NOW } });
    expect(myShiftsCall![0].where.shift.start).toBeUndefined();
  });

  describe("scope=home", () => {
    it("windows available shifts to a week at the user's own restaurant", async () => {
      stubSignupQueries();

      await GET(makeRequest("?scope=home"));

      const availableCall = mockPrisma.shift.findMany.mock.calls[0][0];
      expect(availableCall.where.location).toBe("Onehunga");
      expect(availableCall.where.start).toEqual({
        gte: NOW,
        lt: new Date("2026-07-22T19:29:00Z"),
      });
    });

    it("skips the past-shifts query and the per-shift friend map", async () => {
      const mine = makeSignup(
        "mine",
        new Date("2026-07-16T17:30:00Z"),
        new Date("2026-07-16T21:30:00Z")
      );
      stubSignupQueries({
        mine: [mine],
        visible: [
          {
            shiftId: "shift-mine",
            status: "CONFIRMED",
            user: {
              id: "friend-1",
              name: "Ana",
              firstName: "Ana",
              lastName: null,
              profilePhotoUrl: null,
            },
          },
        ],
      });

      const json = await (await GET(makeRequest("?scope=home"))).json();

      expect(json.past).toEqual([]);
      expect(json.pastNextCursor).toBeNull();
      // periodFriends still drives the home hero's "who else is on" row.
      expect(Object.keys(json.periodFriends)).toHaveLength(1);
      // shiftFriends is the Shifts tab's map — home never reads it.
      expect(json.shiftFriends).toEqual({});
      // No signup.findMany call filtered on past shifts.
      expect(
        mockPrisma.signup.findMany.mock.calls.some(
          (call) => call[0]?.where?.shift?.end?.lt
        )
      ).toBe(false);
    });

    it("does not filter by location when the user has no default restaurant", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ defaultLocation: null });
      stubSignupQueries();

      await GET(makeRequest("?scope=home"));

      expect(mockPrisma.shift.findMany.mock.calls[0][0].where.location).toBeUndefined();
    });
  });

  it("keeps the full three-month, all-location payload when scope is omitted", async () => {
    stubSignupQueries();

    const json = await (await GET(makeRequest())).json();

    const availableCall = mockPrisma.shift.findMany.mock.calls[0][0];
    expect(availableCall.where.location).toBeUndefined();
    // 18:29Z, not 19:29Z: setMonth runs in Pacific/Auckland and July→October
    // crosses into NZDT, so the window end lands an hour earlier in UTC.
    expect(availableCall.where.start).toEqual({
      gte: NOW,
      lt: new Date("2026-10-15T18:29:00Z"),
    });
    // Old app builds still get every key they did before.
    expect(Object.keys(json).sort()).toEqual([
      "available",
      "locations",
      "myShifts",
      "past",
      "pastNextCursor",
      "periodFriends",
      "shiftFriends",
      "userDefaultLocation",
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });
});
