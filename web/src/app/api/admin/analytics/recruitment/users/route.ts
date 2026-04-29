import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getRecruitmentSegmentUsers } from "@/lib/recruitment-users";
import type {
  FunnelStageKey,
  RecruitmentSegment,
  TimeBucketKey,
} from "@/lib/recruitment-types";

const FUNNEL_STAGES: ReadonlySet<FunnelStageKey> = new Set([
  "totalRegistrations",
  "profileComplete",
  "signedUp",
  "completedShift",
]);

const TIME_BUCKETS: ReadonlySet<TimeBucketKey> = new Set([
  "sameDay",
  "within3Days",
  "within7Days",
  "within14Days",
  "within30Days",
  "within60Days",
  "within90Days",
  "over90Days",
]);

function parseSegment(params: URLSearchParams): RecruitmentSegment | null {
  const chart = params.get("chart");
  const location = params.get("segmentLocation");
  if (!location) return null;

  if (chart === "trend") {
    const monthKey = params.get("monthKey");
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
    return { chart, monthKey, location };
  }

  if (chart === "funnel") {
    const stage = params.get("stage");
    if (!stage || !FUNNEL_STAGES.has(stage as FunnelStageKey)) return null;
    return { chart, stage: stage as FunnelStageKey, location };
  }

  if (chart === "timeToFirstShift") {
    const bucket = params.get("bucket");
    if (!bucket || !TIME_BUCKETS.has(bucket as TimeBucketKey)) return null;
    return { chart, bucket: bucket as TimeBucketKey, location };
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

  const monthsRaw = parseInt(params.get("months") || "3", 10);
  const months =
    Number.isFinite(monthsRaw) && monthsRaw > 0 && monthsRaw <= 24
      ? monthsRaw
      : 3;
  const locationFilter = params.get("location");

  try {
    const data = await getRecruitmentSegmentUsers({
      segment,
      months,
      locationFilter,
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recruitment segment users:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteers" },
      { status: 500 }
    );
  }
}
