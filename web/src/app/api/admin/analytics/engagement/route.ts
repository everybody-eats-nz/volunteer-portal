import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const months = parseInt(searchParams.get("months") || "3", 10);
  const location = searchParams.get("location");

  try {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setMonth(periodStart.getMonth() - months);

    // Build shift location filter
    const locationFilter =
      location && location !== "all" ? { location } : {};

    // Get all volunteers (non-admin users)
    const volunteers = await prisma.user.findMany({
      where: { role: "VOLUNTEER" },
      select: {
        id: true,
        signups: {
          where: { status: "CONFIRMED" },
          select: {
            shift: {
              select: { end: true, location: true },
            },
          },
        },
      },
    });

    let activeCount = 0;
    let highlyActiveCount = 0;
    let inactiveCount = 0;
    let neverVolunteeredCount = 0;
    let newInPeriodCount = 0;

    // Track monthly active volunteers for trend
    const monthlyActiveMap = new Map<string, Set<string>>();

    // Initialize last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyActiveMap.set(key, new Set());
    }

    for (const volunteer of volunteers) {
      // Filter signups to completed shifts (end < now) and optionally by location
      const completedSignups = volunteer.signups.filter((s) => {
        const isPast = s.shift.end < now;
        const matchesLocation =
          !location || location === "all" || s.shift.location === location;
        return isPast && matchesLocation;
      });

      const shiftsInPeriod = completedSignups.filter(
        (s) => s.shift.end >= periodStart
      );
      const totalCompleted = completedSignups.length;

      if (totalCompleted === 0) {
        neverVolunteeredCount++;
        continue;
      }

      // Track monthly activity for trend chart
      for (const signup of completedSignups) {
        const end = signup.shift.end;
        const monthKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
        const monthSet = monthlyActiveMap.get(monthKey);
        if (monthSet) {
          monthSet.add(volunteer.id);
        }
      }

      if (shiftsInPeriod.length === 0) {
        inactiveCount++;
      } else {
        // Check if all their completed shifts are within the period (new volunteer)
        const firstCompletedDate = completedSignups.reduce(
          (earliest, s) =>
            s.shift.end < earliest ? s.shift.end : earliest,
          completedSignups[0].shift.end
        );
        if (firstCompletedDate >= periodStart) {
          newInPeriodCount++;
        }

        const avgPerMonth = shiftsInPeriod.length / months;
        if (avgPerMonth >= 2) {
          highlyActiveCount++;
        } else {
          activeCount++;
        }
      }
    }

    // Build monthly trend array (sorted chronologically)
    const monthlyTrend = Array.from(monthlyActiveMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, volunteers]) => ({
        month,
        activeVolunteers: volunteers.size,
      }));

    // Retention rate: of volunteers who were active in the prior period, how many are still active?
    const priorStart = new Date(periodStart);
    priorStart.setMonth(priorStart.getMonth() - months);

    let priorActiveCount = 0;
    let retainedCount = 0;

    for (const volunteer of volunteers) {
      const completedSignups = volunteer.signups.filter((s) => {
        const isPast = s.shift.end < now;
        const matchesLocation =
          !location || location === "all" || s.shift.location === location;
        return isPast && matchesLocation;
      });

      const inPriorPeriod = completedSignups.some(
        (s) => s.shift.end >= priorStart && s.shift.end < periodStart
      );
      const inCurrentPeriod = completedSignups.some(
        (s) => s.shift.end >= periodStart
      );

      if (inPriorPeriod) {
        priorActiveCount++;
        if (inCurrentPeriod) {
          retainedCount++;
        }
      }
    }

    const retentionRate =
      priorActiveCount > 0
        ? Math.round((retainedCount / priorActiveCount) * 100)
        : 0;

    const totalVolunteers = volunteers.length;

    return NextResponse.json({
      summary: {
        totalVolunteers,
        activeCount,
        highlyActiveCount,
        inactiveCount,
        neverVolunteeredCount,
        retentionRate,
        newInPeriodCount,
      },
      monthlyTrend,
      breakdown: [
        { label: "Highly Active", value: highlyActiveCount, color: "#10b981" },
        { label: "Active", value: activeCount, color: "#3b82f6" },
        { label: "Inactive", value: inactiveCount, color: "#f59e0b" },
        {
          label: "Never Volunteered",
          value: neverVolunteeredCount,
          color: "#ef4444",
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching engagement analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement data" },
      { status: 500 }
    );
  }
}
