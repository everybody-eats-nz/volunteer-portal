import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getShortageNotificationAnalytics,
  parseMonthsParam,
} from "@/lib/shortage-analytics";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  // "all" (or 0) means all time — no lower bound on the window.
  const months = parseMonthsParam(searchParams.get("months"));
  const location = searchParams.get("location");

  try {
    const data = await getShortageNotificationAnalytics(months, location);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shortage notification analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch shortage notification data" },
      { status: 500 }
    );
  }
}
