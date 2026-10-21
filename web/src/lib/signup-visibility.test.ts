import { describe, expect, it } from "vitest";
import { isSignupVisible, visibleSignupsWhere } from "./signup-visibility";

const friendIds = new Set(["friend"]);

const signup = (
  status: "CONFIRMED" | "PENDING" | "REGULAR_PENDING" | "WAITLISTED",
  id: string,
  friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE"
) => ({ status, user: { id, friendVisibility } });

describe("isSignupVisible", () => {
  it("names confirmed volunteers with public profiles, or friends-only profiles to friends", () => {
    expect(isSignupVisible(signup("CONFIRMED", "stranger", "PUBLIC"), friendIds)).toBe(true);
    expect(isSignupVisible(signup("CONFIRMED", "friend", "FRIENDS_ONLY"), friendIds)).toBe(true);
    expect(isSignupVisible(signup("CONFIRMED", "stranger", "FRIENDS_ONLY"), friendIds)).toBe(false);
    expect(isSignupVisible(signup("CONFIRMED", "friend", "PRIVATE"), friendIds)).toBe(false);
  });

  it("only names a request awaiting approval when the profile is public, even to friends", () => {
    expect(isSignupVisible(signup("PENDING", "stranger", "PUBLIC"), friendIds)).toBe(true);
    expect(isSignupVisible(signup("REGULAR_PENDING", "stranger", "PUBLIC"), friendIds)).toBe(true);
    expect(isSignupVisible(signup("PENDING", "friend", "FRIENDS_ONLY"), friendIds)).toBe(false);
    expect(isSignupVisible(signup("REGULAR_PENDING", "friend", "FRIENDS_ONLY"), friendIds)).toBe(false);
    expect(isSignupVisible(signup("PENDING", "friend", "PRIVATE"), friendIds)).toBe(false);
  });

  it("never names waitlisted volunteers", () => {
    expect(isSignupVisible(signup("WAITLISTED", "friend", "PUBLIC"), friendIds)).toBe(false);
  });
});

describe("visibleSignupsWhere", () => {
  it("limits pending signups to public profiles", () => {
    expect(visibleSignupsWhere(friendIds)).toEqual({
      OR: [
        {
          status: "CONFIRMED",
          user: {
            OR: [
              { friendVisibility: "PUBLIC" },
              { friendVisibility: "FRIENDS_ONLY", id: { in: ["friend"] } },
            ],
          },
        },
        {
          status: { in: ["PENDING", "REGULAR_PENDING"] },
          user: { friendVisibility: "PUBLIC" },
        },
      ],
    });
  });

  it("drops the friends clause when the viewer has no friends", () => {
    const where = visibleSignupsWhere(new Set());
    expect(where.OR?.[0]).toEqual({
      status: "CONFIRMED",
      user: { OR: [{ friendVisibility: "PUBLIC" }] },
    });
  });
});
