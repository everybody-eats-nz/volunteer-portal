import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";
import { createRegularVolunteerSignups } from "@/lib/regular-volunteer-utils";

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

    // Use shared utility for matching and signup creation
    const result = await createRegularVolunteerSignups(
      shifts,
      regularVolunteers,
      { dryRun: validated.dryRun }
    );

    // Build preview from result records
    // Create a userId -> volunteer name lookup
    const volunteerNameMap = new Map(
      regularVolunteers.map((r) => [
        r.id,
        [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || r.userId,
      ])
    );

    const volunteerSignupCounts = new Map<string, { name: string; count: number; regularId: string }>();
    const locationCounts = new Map<string, number>();
    const shiftLocationMap = new Map(shifts.map((s) => [s.id, s.location || "General"]));

    for (const record of result.signupRecords) {
      const existing = volunteerSignupCounts.get(record.regularVolunteerId);
      if (existing) {
        existing.count++;
      } else {
        volunteerSignupCounts.set(record.regularVolunteerId, {
          name: volunteerNameMap.get(record.regularVolunteerId) || record.userId,
          count: 1,
          regularId: record.regularVolunteerId,
        });
      }
      const loc = shiftLocationMap.get(record.shiftId) || "General";
      locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    }

    const preview = {
      volunteers: Array.from(volunteerSignupCounts.values())
        .sort((a, b) => b.count - a.count)
        .map(({ name, count, regularId }) => ({ name, signups: count, id: regularId })),
      locations: Array.from(locationCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([location, signups]) => ({ location, signups })),
    };

    const count = result.signupsCreated;
    const action = validated.dryRun ? "Will create" : "Created";
    const responseKey = validated.dryRun ? "signupsToCreate" : "signupsCreated";

    return NextResponse.json({
      [responseKey]: count,
      shiftsProcessed: shifts.length,
      preview,
      message:
        count > 0
          ? `${action} ${count} signup${count === 1 ? "" : "s"} across ${shifts.length} shift${shifts.length === 1 ? "" : "s"}`
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
