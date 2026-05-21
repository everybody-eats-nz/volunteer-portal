import { prisma } from "@/lib/prisma";

export type FeedItemOwner = {
  ownerId: string;
  itemLabel: string;
};

export async function resolveFeedItemOwner(
  feedItemId: string
): Promise<FeedItemOwner | null> {
  if (feedItemId.startsWith("achievement-")) {
    const ua = await prisma.userAchievement.findUnique({
      where: { id: feedItemId.slice("achievement-".length) },
      select: { userId: true },
    });
    return ua ? { ownerId: ua.userId, itemLabel: "your achievement" } : null;
  }

  if (feedItemId.startsWith("friend-signup-")) {
    const signup = await prisma.signup.findUnique({
      where: { id: feedItemId.slice("friend-signup-".length) },
      select: { userId: true },
    });
    return signup
      ? { ownerId: signup.userId, itemLabel: "your shift signup" }
      : null;
  }

  if (feedItemId.startsWith("announcement-")) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: feedItemId.slice("announcement-".length) },
      select: { createdBy: true },
    });
    return announcement
      ? { ownerId: announcement.createdBy, itemLabel: "your announcement" }
      : null;
  }

  // System-generated items (new-shift-*, shift-recap-*, daily-menu-*) have no owner to notify.
  return null;
}
