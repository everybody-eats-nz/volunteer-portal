import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getRecommendedFriendsForUser } from "@/lib/friends-data";

/**
 * GET /api/mobile/friends/recommended
 *
 * Mobile equivalent of /api/friends/recommended. Returns volunteers the
 * authenticated user has shared at least N (day/evening) shift slots with
 * over the recent window, plus any pending incoming friend requests.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const recommendedFriends = await getRecommendedFriendsForUser(
    user.id,
    user.email
  );

  return NextResponse.json({ recommendedFriends });
}
