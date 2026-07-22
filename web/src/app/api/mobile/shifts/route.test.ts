import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

// Mock dependencies before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    signup: { findMany: vi.fn() },
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
  signup: { findMany: ReturnType<typeof vi.fn> };
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

function makeRequest() {
  return new Request("http://localhost/api/mobile/shifts", {
    method: "GET",
    headers: { Authorization: "Bearer valid-token" },
  });
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

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });
});
