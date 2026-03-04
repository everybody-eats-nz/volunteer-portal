import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getEngagementSummary } from "@/lib/engagement";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "3", 10);
  const location = searchParams.get("location");

  try {
    const data = await getEngagementSummary(months, location);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching engagement analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement data" },
      { status: 500 }
    );
  }
}
