import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getShiftCoverage } from "@/lib/shift-coverage";
import { parseDaysParam } from "@/lib/parse-days-param";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "3", 10);
  const location = searchParams.get("location");
  const daysFilter = parseDaysParam(searchParams.get("days") || undefined);

  try {
    const data = await getShiftCoverage(months, location, daysFilter);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching shift coverage analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift coverage data" },
      { status: 500 }
    );
  }
}
