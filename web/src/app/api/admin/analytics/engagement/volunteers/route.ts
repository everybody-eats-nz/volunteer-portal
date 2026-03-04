import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getEngagementVolunteers } from "@/lib/engagement";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "3", 10);
  const location = searchParams.get("location");
  const statusFilter = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const sortBy = searchParams.get("sortBy") || "lastShiftDate";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as
    | "asc"
    | "desc";
  const search = searchParams.get("search") || "";

  try {
    const data = await getEngagementVolunteers({
      months,
      location,
      statusFilter,
      page,
      pageSize,
      sortBy,
      sortOrder,
      search,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching engagement volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteer data" },
      { status: 500 }
    );
  }
}
