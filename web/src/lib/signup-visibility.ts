import type { FriendVisibility, Prisma, SignupStatus } from "@/generated/client";

/**
 * Who a volunteer can see on a shift, by name.
 *
 * A confirmed volunteer is visible to friends when their profile is
 * FRIENDS_ONLY, and to everyone when it is PUBLIC. A request still awaiting
 * approval is more sensitive - it may never become a shift - so it is only
 * named when the volunteer's profile is PUBLIC, even to their friends.
 * PRIVATE profiles are never named. Waitlisted signups are never listed.
 */

const PENDING_STATUSES = ["PENDING", "REGULAR_PENDING"] as const;

/**
 * Prisma filter for the signups the viewer may see named. Combine it with the
 * query's own shift / status conditions.
 */
export function visibleSignupsWhere(
  friendIds: Set<string>
): Prisma.SignupWhereInput {
  return {
    OR: [
      {
        status: "CONFIRMED",
        user: {
          OR: [
            { friendVisibility: "PUBLIC" },
            ...(friendIds.size > 0
              ? [
                  {
                    friendVisibility: "FRIENDS_ONLY" as const,
                    id: { in: Array.from(friendIds) },
                  },
                ]
              : []),
          ],
        },
      },
      {
        status: { in: [...PENDING_STATUSES] },
        user: { friendVisibility: "PUBLIC" },
      },
    ],
  };
}

/** The same rule as `visibleSignupsWhere`, for signups already loaded. */
export function isSignupVisible(
  signup: {
    status: SignupStatus;
    user: { id: string; friendVisibility: FriendVisibility };
  },
  friendIds: Set<string>
): boolean {
  const { friendVisibility, id } = signup.user;
  if (signup.status === "CONFIRMED") {
    return (
      friendVisibility === "PUBLIC" ||
      (friendVisibility === "FRIENDS_ONLY" && friendIds.has(id))
    );
  }
  if ((PENDING_STATUSES as readonly string[]).includes(signup.status)) {
    return friendVisibility === "PUBLIC";
  }
  return false;
}
