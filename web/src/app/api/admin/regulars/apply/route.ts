import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";

const applyRegularsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dryRun: z.boolean().optional().default(false),
  location: z.string().min(1).optional(),
  regularVolunteerIds: z.array(z.string()).optional(),
});

// POST /api/admin/regulars/apply - Apply regular volunteers to existing shifts in a date range
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const validated = applyRegularsSchema.parse(body);

    const start = toUTC(parseISOInNZT(validated.startDate));
    const end = toUTC(parseISOInNZT(validated.endDate));

    // endDate should cover the full day
    const endOfRange = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    if (end < start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    // Find all shifts in the date range (optionally filtered by location)
    const shifts = await prisma.shift.findMany({
      where: {
        start: { gte: start, lt: endOfRange },
        ...(validated.location && { location: validated.location }),
      },
      orderBy: { start: "asc" },
    });

    if (shifts.length === 0) {
      return NextResponse.json({
        signupsToCreate: 0,
        signupsCreated: 0,
        shiftsProcessed: 0,
        preview: { volunteers: [], locations: [] },
        message: "No shifts found in the selected date range",
      });
    }

    // If specific regular volunteer IDs provided, use those directly.
    // Otherwise, batch query by shift configurations.
    let regularVolunteers: Array<{
      id: string;
      userId: string;
      shiftTypeId: string;
      location: string;
      frequency: string;
      availableDays: string[];
      autoApprove: boolean;
      createdAt: Date;
      user: { firstName: string | null; lastName: string | null };
    }>;

    if (validated.regularVolunteerIds?.length) {
      regularVolunteers = await prisma.regularVolunteer.findMany({
        where: {
          id: { in: validated.regularVolunteerIds },
          isActive: true,
          isPausedByUser: false,
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      });
    } else {
      // Build unique shift configurations (shiftTypeId, location, dayOfWeek)
      const shiftConfigs = new Map<string, Set<string>>();
      for (const shift of shifts) {
        const dayOfWeek = formatInNZT(shift.start, "EEEE");
        const key = `${shift.shiftTypeId}|${shift.location || ""}`;
        if (!shiftConfigs.has(key)) {
          shiftConfigs.set(key, new Set());
        }
        shiftConfigs.get(key)!.add(dayOfWeek);
      }

      const allRegularVolunteers = await Promise.all(
        Array.from(shiftConfigs.entries()).map(([key, days]) => {
          const [shiftTypeId, location] = key.split("|");
          return prisma.regularVolunteer.findMany({
            where: {
              shiftTypeId,
              ...(location && { location }),
              isActive: true,
              isPausedByUser: false,
              availableDays: { hasSome: Array.from(days) },
            },
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          });
        })
      );
      regularVolunteers = allRegularVolunteers.flat();
    }

    if (regularVolunteers.length === 0) {
      return NextResponse.json({
        signupsToCreate: 0,
        signupsCreated: 0,
        shiftsProcessed: shifts.length,
        preview: { volunteers: [], locations: [] },
        message: "No matching regular volunteers found",
      });
    }

    // Get all unique volunteer IDs and query existing signups in the range
    const volunteerIds = [...new Set(regularVolunteers.map((r) => r.userId))];
    const existingSignups = await prisma.signup.findMany({
      where: {
        userId: { in: volunteerIds },
        shift: {
          start: { gte: start, lt: endOfRange },
        },
        status: { in: ["CONFIRMED", "REGULAR_PENDING", "PENDING"] },
      },
      select: {
        userId: true,
        shiftId: true,
        shift: { select: { start: true } },
      },
    });

    // Build lookup: userId -> Set of date keys (NZ timezone) AND userId -> Set of shiftIds
    const existingByDate = new Map<string, Set<string>>();
    const existingByShift = new Map<string, Set<string>>();
    for (const signup of existingSignups) {
      const dateKey = formatInNZT(signup.shift.start, "yyyy-MM-dd");
      if (!existingByDate.has(signup.userId)) {
        existingByDate.set(signup.userId, new Set());
      }
      existingByDate.get(signup.userId)!.add(dateKey);

      if (!existingByShift.has(signup.userId)) {
        existingByShift.set(signup.userId, new Set());
      }
      existingByShift.get(signup.userId)!.add(signup.shiftId);
    }

    // Build regular volunteer lookup by (shiftTypeId, location, dayOfWeek)
    const regularsByConfig = new Map<string, typeof regularVolunteers>();
    for (const regular of regularVolunteers) {
      for (const day of regular.availableDays) {
        const key = `${regular.shiftTypeId}|${regular.location || ""}|${day}`;
        if (!regularsByConfig.has(key)) {
          regularsByConfig.set(key, []);
        }
        regularsByConfig.get(key)!.push(regular);
      }
    }

    // Process all shifts and build signup batches
    // Track per-volunteer and per-location counts for preview
    const volunteerSignupCounts = new Map<string, { name: string; count: number; regularId: string }>();
    const locationCounts = new Map<string, number>();

    const allSignups: Array<{
      id: string;
      userId: string;
      shiftId: string;
      status: "REGULAR_PENDING" | "CONFIRMED";
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    const allRegularSignups: Array<{
      regularVolunteerId: string;
      signupId: string;
    }> = [];

    for (const shift of shifts) {
      const dayOfWeek = formatInNZT(shift.start, "EEEE");
      const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
      const key = `${shift.shiftTypeId}|${shift.location || ""}|${dayOfWeek}`;
      const matchingVolunteers = regularsByConfig.get(key) || [];

      // Filter by frequency
      const matchingRegulars = matchingVolunteers.filter((regular) => {
        if (regular.frequency === "WEEKLY") {
          return true;
        } else if (regular.frequency === "FORTNIGHTLY") {
          const weeksSinceCreation = Math.floor(
            (shift.start.getTime() - regular.createdAt.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );
          return weeksSinceCreation % 2 === 0;
        } else if (regular.frequency === "MONTHLY") {
          const firstOccurrenceInMonth = new Date(
            shift.start.getFullYear(),
            shift.start.getMonth(),
            1
          );
          while (firstOccurrenceInMonth.getDay() !== shift.start.getDay()) {
            firstOccurrenceInMonth.setDate(
              firstOccurrenceInMonth.getDate() + 1
            );
          }
          return shift.start.getDate() === firstOccurrenceInMonth.getDate();
        }
        return false;
      });

      for (const regular of matchingRegulars) {
        // Skip if volunteer already has a signup for this specific shift
        if (existingByShift.get(regular.userId)?.has(shift.id)) {
          continue;
        }
        // Skip if volunteer already has a signup for this day
        if (existingByDate.get(regular.userId)?.has(dateKey)) {
          continue;
        }

        const signupId = crypto.randomUUID();
        allSignups.push({
          id: signupId,
          userId: regular.userId,
          shiftId: shift.id,
          status: regular.autoApprove ? "CONFIRMED" : "REGULAR_PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        allRegularSignups.push({
          regularVolunteerId: regular.id,
          signupId: signupId,
        });

        // Track preview data
        const volName = [regular.user.firstName, regular.user.lastName]
          .filter(Boolean)
          .join(" ") || regular.userId;
        const existing = volunteerSignupCounts.get(regular.id);
        if (existing) {
          existing.count++;
        } else {
          volunteerSignupCounts.set(regular.id, { name: volName, count: 1, regularId: regular.id });
        }
        const loc = shift.location || "General";
        locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);

        // Track the new signup so we don't double-assign within this batch
        if (!existingByDate.has(regular.userId)) {
          existingByDate.set(regular.userId, new Set());
        }
        existingByDate.get(regular.userId)!.add(dateKey);
        if (!existingByShift.has(regular.userId)) {
          existingByShift.set(regular.userId, new Set());
        }
        existingByShift.get(regular.userId)!.add(shift.id);
      }
    }

    // Build preview breakdown
    const preview = {
      volunteers: Array.from(volunteerSignupCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ name, count, regularId }) => ({ name, signups: count, id: regularId })),
      locations: Array.from(locationCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([location, signups]) => ({ location, signups })),
    };

    // If dry run, return preview without creating anything
    if (validated.dryRun) {
      return NextResponse.json({
        signupsToCreate: allSignups.length,
        shiftsProcessed: shifts.length,
        preview,
        message:
          allSignups.length > 0
            ? `Will create ${allSignups.length} signup${allSignups.length === 1 ? "" : "s"} across ${shifts.length} shift${shifts.length === 1 ? "" : "s"}`
            : "All regular volunteers are already signed up for matching shifts",
      });
    }

    // Create signups in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < allSignups.length; i += BATCH_SIZE) {
      const signupBatch = allSignups.slice(i, i + BATCH_SIZE);
      const regularSignupBatch = allRegularSignups.slice(i, i + BATCH_SIZE);
      await prisma.signup.createMany({ data: signupBatch });
      await prisma.regularSignup.createMany({ data: regularSignupBatch });
    }

    return NextResponse.json({
      signupsCreated: allSignups.length,
      shiftsProcessed: shifts.length,
      preview,
      message:
        allSignups.length > 0
          ? `Created ${allSignups.length} signup${allSignups.length === 1 ? "" : "s"} across ${shifts.length} shift${shifts.length === 1 ? "" : "s"}`
          : "All regular volunteers are already signed up for matching shifts",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error applying regular volunteers:", error);
    return NextResponse.json(
      { error: "Failed to apply regular volunteers" },
      { status: 500 }
    );
  }
}
