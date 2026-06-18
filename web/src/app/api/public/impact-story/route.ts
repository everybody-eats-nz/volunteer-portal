import { NextResponse } from "next/server";
import { getPublicImpactStory } from "@/lib/impact-story";

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
 * Public impact-story endpoint consumed by the marketing site's `/impact` page.
 *
 * Returns the all-time, aggregate, non-sensitive dataset behind the data-story:
 * a year-by-year koha/need breakdown, payment mix, per-venue and per-weekday
 * rhythms, and the volunteer milestone ladder. See {@link getPublicImpactStory}.
 *
 * Cached at the edge for 1 hour; these totals move slowly.
 */
export async function GET() {
  try {
    const story = await getPublicImpactStory();
    return NextResponse.json(story, {
      headers: {
        ...corsHeaders,
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error computing impact story:", error);
    return NextResponse.json(
      { error: "Failed to compute impact story" },
      { status: 500, headers: corsHeaders }
    );
  }
}
