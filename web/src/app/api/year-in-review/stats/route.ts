import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { calculateYearStats } from "@/lib/year-in-review/stats-calculator";
import { isSeasonallyAvailable } from "@/lib/year-in-review/season-checker";

/**
 * GET /api/year-in-review/stats?year=2024
 * Fetch year-in-review statistics for the authenticated user
 *
 * Query params:
 * - year: The year to get stats for (defaults to current year)
 *
 * Returns:
 * - 200: YearStats object with all metrics
 * - 401: Unauthorized (no session)
 * - 403: Forbidden (not in season or no access)
 * - 404: No shifts found for the specified year
 * - 400: Invalid year parameter
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check seasonal availability
  if (!isSeasonallyAvailable()) {
    return NextResponse.json(
      {
        error: "Year in Review is only available in December and January",
        available: false,
      },
      { status: 403 }
    );
  }

  // Parse and validate year parameter
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const currentYear = new Date().getFullYear();
  const year = yearParam ? parseInt(yearParam, 10) : currentYear;

  // Validate year
  if (isNaN(year) || year > currentYear || year < 2020) {
    return NextResponse.json(
      {
        error: "Invalid year parameter. Must be between 2020 and current year.",
      },
      { status: 400 }
    );
  }

  try {
    // Calculate stats for the year
    const stats = await calculateYearStats(session.user.id, year);

    // If no stats (no shifts), return 404
    if (!stats) {
      return NextResponse.json(
        {
          error: "No volunteer activity found for this year",
          year,
          hasActivity: false,
        },
        { status: 404 }
      );
    }

    // Return stats
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("Error calculating year stats:", error);
    return NextResponse.json(
      {
        error: "Failed to calculate statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
