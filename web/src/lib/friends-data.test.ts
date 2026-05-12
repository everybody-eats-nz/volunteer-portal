import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth-options", () => ({
  authOptions: {},
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: { findMany: vi.fn() },
    friendship: { findMany: vi.fn() },
    friendRequest: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import { getShiftSlotKey, getRecommendedFriendsForUser } from "./friends-data";
import { prisma } from "./prisma";

type SignupFindMany = ReturnType<typeof vi.fn>;
type FriendshipFindMany = ReturnType<typeof vi.fn>;
type FriendRequestFindMany = ReturnType<typeof vi.fn>;

const mockedSignup = prisma.signup.findMany as unknown as SignupFindMany;
const mockedFriendship = prisma.friendship.findMany as unknown as FriendshipFindMany;
const mockedFriendRequest = prisma.friendRequest.findMany as unknown as FriendRequestFindMany;

/**
 * Build a signup payload matching the include shape expected by
 * `getRecommendedFriendsForUser`'s second `signup.findMany` call.
 */
function candidateSignup(opts: {
  userId: string;
  email?: string;
  firstName?: string;
  shiftId: string;
  start: Date;
  location: string | null;
  shiftTypeName?: string;
}) {
  return {
    user: {
      id: opts.userId,
      name: null,
      firstName: opts.firstName ?? "Cand",
      lastName: null,
      email: opts.email ?? `${opts.userId}@example.com`,
      profilePhotoUrl: null,
    },
    shift: {
      id: opts.shiftId,
      start: opts.start,
      shiftType: { name: opts.shiftTypeName ?? "Dishwasher" },
      location: opts.location,
    },
  };
}

describe("getShiftSlotKey", () => {
  it("generates the same key for two shifts in the same NZ evening slot at the same location", () => {
    // 17:00 UTC on 2024-01-15 = 06:00 NZDT the next day — wait, NZDT is UTC+13
    // in January. So pick a UTC time that lands in NZ evening.
    // 2024-01-15 06:00 UTC = 19:00 NZDT 2024-01-15
    // 2024-01-15 07:30 UTC = 20:30 NZDT 2024-01-15
    const shift1 = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: "Ponsonby",
    };
    const shift2 = {
      start: new Date("2024-01-15T07:30:00Z"),
      location: "Ponsonby",
    };
    expect(getShiftSlotKey(shift1)).toBe(getShiftSlotKey(shift2));
    expect(getShiftSlotKey(shift1)).toContain("EVE");
  });

  it("generates different keys for Day vs Evening at the same location/date", () => {
    // 02:00 UTC = 15:00 NZDT (before 16:00 cutoff → Day)
    // 06:00 UTC = 19:00 NZDT (Evening)
    const day = {
      start: new Date("2024-01-15T02:00:00Z"),
      location: "Ponsonby",
    };
    const evening = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: "Ponsonby",
    };
    expect(getShiftSlotKey(day)).not.toBe(getShiftSlotKey(evening));
    expect(getShiftSlotKey(day)).toContain("DAY");
    expect(getShiftSlotKey(evening)).toContain("EVE");
  });

  it("generates different keys for different locations on the same slot", () => {
    const ponsonby = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: "Ponsonby",
    };
    const wellington = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: "Wellington",
    };
    expect(getShiftSlotKey(ponsonby)).not.toBe(getShiftSlotKey(wellington));
  });

  it("treats a null location as its own bucket distinct from any named location", () => {
    const nullLoc = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: null,
    };
    const named = {
      start: new Date("2024-01-15T06:00:00Z"),
      location: "Ponsonby",
    };
    expect(getShiftSlotKey(nullLoc)).not.toBe(getShiftSlotKey(named));
  });

  it("buckets by NZ-local date, not UTC date", () => {
    // 2024-01-15 11:30 UTC = 2024-01-16 00:30 NZDT
    const lateUtc = {
      start: new Date("2024-01-15T11:30:00Z"),
      location: "Ponsonby",
    };
    // 2024-01-16 03:00 UTC = 2024-01-16 16:00 NZDT (start of Evening on 16th)
    const nzNextDay = {
      start: new Date("2024-01-16T03:00:00Z"),
      location: "Ponsonby",
    };
    // Both NZ dates should be 2024-01-16
    expect(getShiftSlotKey(lateUtc)).toContain("2024-01-16");
    expect(getShiftSlotKey(nzNextDay)).toContain("2024-01-16");
  });
});

describe("getRecommendedFriendsForUser", () => {
  beforeEach(() => {
    mockedSignup.mockReset();
    mockedFriendship.mockReset();
    mockedFriendRequest.mockReset();
  });

  it("returns an empty list when the user has no recent shifts", async () => {
    mockedSignup.mockResolvedValueOnce([]); // userShifts

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toEqual([]);
    // No further queries should run when there are no shifts
    expect(mockedFriendship).not.toHaveBeenCalled();
  });

  it("suggests a candidate who shares 3+ slot matches even via different shift types", async () => {
    // Three different evenings, three different ponsonby shifts the user attended.
    const myShifts = [
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-22T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-29T06:00:00Z"), location: "Ponsonby" } },
    ];
    mockedSignup.mockResolvedValueOnce(myShifts);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]); // sent
    mockedFriendRequest.mockResolvedValueOnce([]); // received

    // Candidate Aroha was on the SAME evenings at Ponsonby but a different
    // shift type each time. Three distinct slot matches.
    mockedSignup.mockResolvedValueOnce([
      candidateSignup({
        userId: "aroha",
        shiftId: "s1",
        start: new Date("2024-01-15T07:00:00Z"),
        location: "Ponsonby",
        shiftTypeName: "Dishwasher",
      }),
      candidateSignup({
        userId: "aroha",
        shiftId: "s2",
        start: new Date("2024-01-22T07:00:00Z"),
        location: "Ponsonby",
        shiftTypeName: "FOH",
      }),
      candidateSignup({
        userId: "aroha",
        shiftId: "s3",
        start: new Date("2024-01-29T07:00:00Z"),
        location: "Ponsonby",
        shiftTypeName: "Prep",
      }),
    ]);

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("aroha");
    expect(result[0].sharedShiftsCount).toBe(3);
    expect(result[0].isPendingRequest).toBe(false);
  });

  it("excludes a candidate who only matches 2 slots (below threshold)", async () => {
    mockedSignup.mockResolvedValueOnce([
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-22T06:00:00Z"), location: "Ponsonby" } },
    ]);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);

    mockedSignup.mockResolvedValueOnce([
      candidateSignup({
        userId: "kai",
        shiftId: "s1",
        start: new Date("2024-01-15T07:00:00Z"),
        location: "Ponsonby",
      }),
      candidateSignup({
        userId: "kai",
        shiftId: "s2",
        start: new Date("2024-01-22T07:00:00Z"),
        location: "Ponsonby",
      }),
    ]);

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toEqual([]);
  });

  it("dedupes when a candidate has multiple shifts in the same slot (counts as 1)", async () => {
    // User attended 3 distinct evenings.
    mockedSignup.mockResolvedValueOnce([
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-22T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-29T06:00:00Z"), location: "Ponsonby" } },
    ]);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);

    // Candidate signed up for TWO shifts on the same evening (Jan 15) — should
    // dedupe to one shared slot, leaving only 2 distinct matches → below threshold.
    mockedSignup.mockResolvedValueOnce([
      candidateSignup({
        userId: "moana",
        shiftId: "s1a",
        start: new Date("2024-01-15T06:30:00Z"),
        location: "Ponsonby",
      }),
      candidateSignup({
        userId: "moana",
        shiftId: "s1b",
        start: new Date("2024-01-15T08:00:00Z"),
        location: "Ponsonby",
      }),
      candidateSignup({
        userId: "moana",
        shiftId: "s2",
        start: new Date("2024-01-22T07:00:00Z"),
        location: "Ponsonby",
      }),
    ]);

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    // 2 distinct slots — below the 3-slot threshold.
    expect(result).toEqual([]);
  });

  it("excludes a candidate whose only matches are at a different location", async () => {
    mockedSignup.mockResolvedValueOnce([
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-22T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-29T06:00:00Z"), location: "Ponsonby" } },
    ]);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]);

    // Even though dates match, location does not.
    mockedSignup.mockResolvedValueOnce([
      candidateSignup({
        userId: "tane",
        shiftId: "s1",
        start: new Date("2024-01-15T07:00:00Z"),
        location: "Wellington",
      }),
      candidateSignup({
        userId: "tane",
        shiftId: "s2",
        start: new Date("2024-01-22T07:00:00Z"),
        location: "Wellington",
      }),
      candidateSignup({
        userId: "tane",
        shiftId: "s3",
        start: new Date("2024-01-29T07:00:00Z"),
        location: "Wellington",
      }),
    ]);

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toEqual([]);
  });

  it("surfaces an incoming pending friend request even when shared-shift count is zero", async () => {
    mockedSignup.mockResolvedValueOnce([
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
    ]);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([]); // sent

    // Pending request from "nia" who has no shared shifts with us.
    mockedFriendRequest.mockResolvedValueOnce([
      {
        id: "req-1",
        fromUser: {
          id: "nia",
          name: "Nia",
          firstName: "Nia",
          lastName: null,
          email: "nia@example.com",
          profilePhotoUrl: null,
        },
      },
    ]);

    mockedSignup.mockResolvedValueOnce([]); // no shared signups

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("nia");
    expect(result[0].isPendingRequest).toBe(true);
    expect(result[0].requestId).toBe("req-1");
    expect(result[0].sharedShiftsCount).toBe(0);
  });

  it("excludes candidates the user has already sent a pending request to", async () => {
    mockedSignup.mockResolvedValueOnce([
      { shift: { start: new Date("2024-01-15T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-22T06:00:00Z"), location: "Ponsonby" } },
      { shift: { start: new Date("2024-01-29T06:00:00Z"), location: "Ponsonby" } },
    ]);
    mockedFriendship.mockResolvedValueOnce([]);
    mockedFriendRequest.mockResolvedValueOnce([
      { toEmail: "aroha@example.com" },
    ]); // sent to aroha
    mockedFriendRequest.mockResolvedValueOnce([]); // received

    mockedSignup.mockResolvedValueOnce([
      candidateSignup({
        userId: "aroha",
        email: "aroha@example.com",
        shiftId: "s1",
        start: new Date("2024-01-15T07:00:00Z"),
        location: "Ponsonby",
      }),
      candidateSignup({
        userId: "aroha",
        email: "aroha@example.com",
        shiftId: "s2",
        start: new Date("2024-01-22T07:00:00Z"),
        location: "Ponsonby",
      }),
      candidateSignup({
        userId: "aroha",
        email: "aroha@example.com",
        shiftId: "s3",
        start: new Date("2024-01-29T07:00:00Z"),
        location: "Ponsonby",
      }),
    ]);

    const result = await getRecommendedFriendsForUser("me", "me@example.com");

    expect(result).toEqual([]);
  });
});
