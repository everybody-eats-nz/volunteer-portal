import { NextResponse } from "next/server";
import { getRecommendedFriends } from "@/lib/friends-data";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recommendedFriends = await getRecommendedFriends();
  return NextResponse.json({ recommendedFriends });
}
