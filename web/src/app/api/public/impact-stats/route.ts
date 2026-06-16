import { NextResponse } from "next/server";
import { getPublicImpactStats } from "@/lib/impact-stats";

// CORS headers so external consumers (e.g. the marketing site) can read this.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Public impact-stats endpoint consumed by the marketing site.
 *
 * Returns aggregate, non-sensitive headline figures:
 *   - peopleServed   total customers served across all service nights
 *   - volunteerHours total hours logged across completed confirmed shifts
 *   - foodSavedKg    estimated kg of food saved (derived from people served)
 *
 * Cached at the edge for 1 hour; these totals move slowly.
 */
export async function GET() {
  try {
    const stats = await getPublicImpactStats();
    return NextResponse.json(stats, {
      headers: {
        ...corsHeaders,
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error computing impact stats:", error);
    return NextResponse.json(
      { error: "Failed to compute impact stats" },
      { status: 500, headers: corsHeaders }
    );
  }
}
