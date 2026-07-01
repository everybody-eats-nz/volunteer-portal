import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getShortageConversions } from "@/lib/shortage-analytics";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const monthsParam = searchParams.get("months") || "12";
  const months = monthsParam === "all" ? 0 : parseInt(monthsParam, 10) || 12;
  const location = searchParams.get("location");

  try {
    const data = await getShortageConversions(months, location);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shortage notification conversions:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversions" },
      { status: 500 }
    );
  }
}
