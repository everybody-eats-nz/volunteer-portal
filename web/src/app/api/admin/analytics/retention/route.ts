import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays, startOfMonth, format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const location = searchParams.get("location") || "all";
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : addDays(new Date(), -90);
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : new Date();
    const volunteerGrade = searchParams.get("volunteerGrade");

    // Build location filter
    const locationFilter =
      location && location !== "all" ? { location } : {};

    // Build volunteer grade filter
    const gradeFilter = volunteerGrade
      ? { volunteerGrade: volunteerGrade as any }
      : {};

    // Fetch volunteers with their signups
    const volunteers = await prisma.user.findMany({
      where: {
        role: "VOLUNTEER",
        createdAt: { gte: startDate, lte: endDate },
        ...gradeFilter,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        volunteerGrade: true,
        signups: {
          where: {
            status: "CONFIRMED",
            ...(location && location !== "all"
              ? { shift: { location } }
              : {}),
          },
          select: {
            createdAt: true,
            shift: {
              select: {
                start: true,
                end: true,
              },
            },
          },
          orderBy: {
            shift: {
              end: "desc",
            },
          },
        },
      },
    });

    // Calculate cohort data
    const cohortMap = new Map<
      string,
      {
        cohortMonth: string;
        volunteersStarted: number;
        retained30Days: number;
        retained60Days: number;
        retained90Days: number;
      }
    >();

    volunteers.forEach((volunteer) => {
      const cohortMonth = format(startOfMonth(volunteer.createdAt), "yyyy-MM");
      const joinDate = volunteer.createdAt;

      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, {
          cohortMonth,
          volunteersStarted: 0,
          retained30Days: 0,
          retained60Days: 0,
          retained90Days: 0,
        });
      }

      const cohort = cohortMap.get(cohortMonth)!;
      cohort.volunteersStarted++;

      // Check if volunteer had shifts in retention windows
      const hasShiftAfter = (days: number) => {
        const cutoffDate = addDays(joinDate, days);
        return volunteer.signups.some(
          (signup) => signup.shift.end >= cutoffDate
        );
      };

      if (hasShiftAfter(30)) cohort.retained30Days++;
      if (hasShiftAfter(60)) cohort.retained60Days++;
      if (hasShiftAfter(90)) cohort.retained90Days++;
    });

    const cohortData = Array.from(cohortMap.values())
      .map((cohort) => ({
        ...cohort,
        retentionRate30:
          cohort.volunteersStarted > 0
            ? Math.round(
                (cohort.retained30Days / cohort.volunteersStarted) * 100
              )
            : 0,
        retentionRate60:
          cohort.volunteersStarted > 0
            ? Math.round(
                (cohort.retained60Days / cohort.volunteersStarted) * 100
              )
            : 0,
        retentionRate90:
          cohort.volunteersStarted > 0
            ? Math.round(
                (cohort.retained90Days / cohort.volunteersStarted) * 100
              )
            : 0,
      }))
      .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));

    // Find at-risk volunteers (no shifts in last 30 days but had 3+ previous shifts)
    const thirtyDaysAgo = addDays(new Date(), -30);

    const atRiskVolunteers = volunteers
      .filter((volunteer) => {
        const totalShifts = volunteer.signups.length;
        if (totalShifts < 3) return false;

        const lastShift = volunteer.signups[0];
        if (!lastShift) return false;

        return lastShift.shift.end < thirtyDaysAgo;
      })
      .map((volunteer) => {
        const lastShift = volunteer.signups[0];
        const daysSinceLastShift = lastShift
          ? differenceInDays(new Date(), lastShift.shift.end)
          : 999;

        // Calculate risk score (0-100)
        // Higher score = higher risk
        // Factors: days since last shift, total shifts completed
        const daysFactor = Math.min(daysSinceLastShift / 90, 1) * 60;
        const shiftFactor =
          volunteer.signups.length >= 10
            ? 40
            : (10 - volunteer.signups.length) * 4;
        const riskScore = Math.min(Math.round(daysFactor + shiftFactor), 100);

        return {
          userId: volunteer.id,
          name: volunteer.name || "Unknown",
          lastShiftDate: lastShift ? lastShift.shift.end.toISOString() : null,
          daysSinceLastShift,
          totalShifts: volunteer.signups.length,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // Calculate dropout analysis
    const activeVolunteers = volunteers.filter(
      (v) => v.signups.length > 0 && v.signups[0].shift.end >= thirtyDaysAgo
    );
    const inactiveVolunteers = volunteers.filter(
      (v) => v.signups.length > 0 && v.signups[0].shift.end < thirtyDaysAgo
    );

    const dropoutDays = inactiveVolunteers
      .filter((v) => v.signups.length > 0)
      .map((v) => {
        const lastShift = v.signups[0];
        return differenceInDays(new Date(), lastShift.shift.end);
      });

    const averageDaysToDropout =
      dropoutDays.length > 0
        ? Math.round(
            dropoutDays.reduce((sum, days) => sum + days, 0) /
              dropoutDays.length
          )
        : 0;

    const dropoutAnalysis = {
      totalVolunteers: volunteers.length,
      activeVolunteers: activeVolunteers.length,
      inactiveVolunteers: inactiveVolunteers.length,
      dropoutRate:
        volunteers.length > 0
          ? Math.round((inactiveVolunteers.length / volunteers.length) * 100)
          : 0,
      averageDaysToDropout,
    };

    return NextResponse.json({
      cohortData,
      atRiskVolunteers,
      dropoutAnalysis,
    });
  } catch (error) {
    console.error("Error fetching retention analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch retention analytics" },
      { status: 500 }
    );
  }
}
