import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getMilestoneSegmentUsers } from "@/lib/milestone-users";
import {
  MILESTONE_DISTRIBUTION_BANDS,
  type MilestoneDistributionBand,
  type MilestoneSegment,
} from "@/lib/milestone-segment-types";

const VALID_THRESHOLDS = new Set([10, 25, 50, 100, 200, 500]);
const VALID_BANDS = new Set<MilestoneDistributionBand>(
  MILESTONE_DISTRIBUTION_BANDS
);

function parseSegment(params: URLSearchParams): MilestoneSegment | null {
  const chart = params.get("chart");
  const location = params.get("segmentLocation");
  if (!location) return null;

  if (chart === "milestoneHits" || chart === "milestoneProjections") {
    const threshold = parseInt(params.get("threshold") || "", 10);
    if (!VALID_THRESHOLDS.has(threshold)) return null;
    return { chart, threshold, location };
  }

  if (chart === "milestoneDistribution") {
    const band = params.get("band") as MilestoneDistributionBand | null;
    if (!band || !VALID_BANDS.has(band)) return null;
    return { chart, band, location };
  }

  return null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const segment = parseSegment(params);
  if (!segment) {
    return NextResponse.json(
      { error: "Invalid segment parameters" },
      { status: 400 }
    );
  }

  const monthsRaw = parseInt(params.get("months") || "12", 10);
  const months =
    Number.isFinite(monthsRaw) && monthsRaw > 0 && monthsRaw <= 36
      ? monthsRaw
      : 12;
  const locationFilter = params.get("location");

  try {
    const data = await getMilestoneSegmentUsers({
      segment,
      months,
      locationFilter,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching milestone segment users:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteers" },
      { status: 500 }
    );
  }
}
