import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { restaurantNightStatsSchema } from "@/lib/validation-schemas";
import { countNewVolunteers } from "@/lib/service-night-attendance";
import { budgetYearOf, resolveNightlyTarget } from "@/lib/budget-calculations";
import { REPORT_FIELDS, ALL_REPORT_FIELDS } from "@/lib/day-reports";
import { dayKeyToDbDate, isDayKey } from "@/lib/shift-day-themes";
import type { Prisma } from "@/generated/client";

const withLines = {
  include: {
    income: { orderBy: { position: "asc" } },
    expenses: { orderBy: { position: "asc" } },
  },
} as const satisfies Prisma.MealsServedDefaultArgs;

// Decimal columns come back as Prisma.Decimal — serialize to plain numbers for JSON.
type MealsServedRecord = Prisma.MealsServedGetPayload<typeof withLines>;

function serializeStats(record: MealsServedRecord) {
  const toNumber = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
  return {
    reportType: record.reportType,
    eventName: record.eventName,
    opensAt: record.opensAt,
    closesAt: record.closesAt,
    income: record.income.map((line) => ({
      source: line.source,
      category: line.category,
      description: line.description,
      amount: Number(line.amount),
      gstIncluded: line.gstIncluded,
    })),
    expenses: record.expenses.map((line) => ({
      category: line.category,
      description: line.description,
      amount: Number(line.amount),
      gstIncluded: line.gstIncluded,
    })),
    mealsServed: record.mealsServed,
    notes: record.notes,
    weather: record.weather,
    bookingsPax: record.bookingsPax,
    newVolunteers: record.newVolunteers,
    nonPayingCount: record.nonPayingCount,
    vege: record.vege,
    takeaways: record.takeaways,
    eftposTransactions: record.eftposTransactions,
    cash: toNumber(record.cash),
    eftpos: toNumber(record.eftpos),
    stripe: toNumber(record.stripe),
    suggestedValue: toNumber(record.suggestedValue),
    protein: record.protein,
  };
}

// GET - Fetch meals served for a specific date and location
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const location = searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location are required" },
      { status: 400 }
    );
  }

  try {
    // Parse date in NZ timezone and get the UTC bounds of the NZ service day
    const dateNZT = parseISOInNZT(date);
    const startOfDayUTC = toUTC(startOfDay(dateNZT));
    const endOfDayUTC = toUTC(endOfDay(dateNZT));

    // New volunteers are derived live from actual attendance, not entered.
    const newVolunteers = await countNewVolunteers({
      location,
      start: startOfDayUTC,
      end: endOfDayUTC,
    });

    const [mealsRecord, locationConfig, dayTheme] = await Promise.all([
      prisma.mealsServed.findUnique({
        where: {
          date_location: {
            date: startOfDayUTC,
            location,
          },
        },
        ...withLines,
      }),
      prisma.location.findUnique({
        where: { name: location },
        include: { budgets: { where: { year: budgetYearOf(startOfDayUTC) } } },
      }),
      // The day's theme ("Rotary Club fundraiser dinner") is the natural
      // name for an event, so the form can offer it.
      isDayKey(date)
        ? prisma.shiftDayTheme.findUnique({
            where: {
              location_date: { location, date: dayKeyToDbDate(date) },
            },
            select: { theme: true },
          })
        : null,
    ]);
    const dayThemeName = dayTheme?.theme ?? null;

    // Pop-up / special-event venues are koha-manual-only (no Stripe sync).
    const isPopup = locationConfig?.isPopup ?? false;

    // The night's koha target, the same one restaurant analytics measures against.
    const target = locationConfig
      ? resolveNightlyTarget(
          {
            targetPerNight:
              locationConfig.targetPerNight === null
                ? null
                : Number(locationConfig.targetPerNight),
            budgets: locationConfig.budgets.map((b) => ({
              year: b.year,
              annualTarget: Number(b.annualTarget),
              plannedServiceNights: b.plannedServiceNights,
            })),
          },
          startOfDayUTC
        )
      : null;

    // If no record exists, get the default from Location model
    if (!mealsRecord) {
      return NextResponse.json({
        reportType: "SERVICE_NIGHT",
        income: [],
        expenses: [],
        mealsServed: null,
        defaultMealsServed: locationConfig?.defaultMealsServed || 60,
        notes: null,
        newVolunteers,
        isPopup,
        target,
        dayTheme: dayThemeName,
      });
    }

    return NextResponse.json({
      ...serializeStats(mealsRecord),
      newVolunteers, // live value overrides the stored snapshot
      defaultMealsServed: null,
      isPopup,
      target,
      dayTheme: dayThemeName,
    });
  } catch (error) {
    console.error("Error fetching meals served:", error);
    return NextResponse.json(
      { error: "Failed to fetch meals served" },
      { status: 500 }
    );
  }
}

// POST/PUT - Update or create the day report (service night, event or cafe)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const parsed = restaurantNightStatsSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const {
      date,
      location,
      income,
      expenses,
      reportType: requestedType,
      ...fields
    } = parsed.data;

    // Parse date in NZ timezone and get the UTC bounds of the NZ service day
    const dateNZT = parseISOInNZT(date);
    const startOfDayUTC = toUTC(startOfDay(dateNZT));
    const endOfDayUTC = toUTC(endOfDay(dateNZT));

    const existing = await prisma.mealsServed.findUnique({
      where: { date_location: { date: startOfDayUTC, location } },
      select: { reportType: true },
    });
    // A client that doesn't send a type (an older build) must never turn an
    // event or cafe day back into a service night and wipe its figures.
    const reportType =
      requestedType ?? existing?.reportType ?? "SERVICE_NIGHT";

    // Keep only the columns this report type owns (plus the shared headcount
    // and notes). Switching a day from a service night to an event clears its
    // koha, so it can't linger in koha totals; switching away from an event
    // drops its income and expense lines below.
    const owned = new Set(REPORT_FIELDS[reportType]);
    const stats = { ...fields } as Record<string, unknown>;
    for (const field of ALL_REPORT_FIELDS) {
      if (!owned.has(field)) stats[field] = null;
    }
    const incomeLines = reportType === "EVENT" ? income : [];
    const expenseLines = reportType === "EVENT" ? expenses : [];

    // Require something to save — don't create empty rows. Marking a day as
    // an event or cafe is itself worth recording, and an existing day may be
    // cleared (say, an event switched back to a not-yet-recorded service night).
    const hasAnyValue =
      reportType !== "SERVICE_NIGHT" ||
      incomeLines.length > 0 ||
      expenseLines.length > 0 ||
      existing !== null ||
      Object.values(stats).some((v) => v !== null);
    if (!hasAnyValue) {
      return NextResponse.json(
        { error: "Enter at least one stat before saving" },
        { status: 400 }
      );
    }

    // New volunteers are derived from attendance, not from the request body.
    const newVolunteers = await countNewVolunteers({
      location,
      start: startOfDayUTC,
      end: endOfDayUTC,
    });

    const data = {
      ...(stats as Omit<Prisma.MealsServedUncheckedCreateInput, "date" | "location">),
      reportType,
      newVolunteers,
      createdBy: session.user.id,
    };

    // Upsert the day report and replace its income and expense lines in one
    // go, so the saved lines always match what the admin saw when they
    // pressed Save.
    const mealsRecord = await prisma.$transaction(async (tx) => {
      const report = await tx.mealsServed.upsert({
        where: {
          date_location: {
            date: startOfDayUTC,
            location,
          },
        },
        update: data,
        create: { date: startOfDayUTC, location, ...data },
        select: { id: true },
      });
      await tx.eventIncome.deleteMany({ where: { reportId: report.id } });
      if (incomeLines.length > 0) {
        await tx.eventIncome.createMany({
          data: incomeLines.map((line, position) => ({
            ...line,
            reportId: report.id,
            position,
          })),
        });
      }
      await tx.eventExpense.deleteMany({ where: { reportId: report.id } });
      if (expenseLines.length > 0) {
        await tx.eventExpense.createMany({
          data: expenseLines.map((line, position) => ({
            ...line,
            reportId: report.id,
            position,
          })),
        });
      }
      return tx.mealsServed.findUniqueOrThrow({
        where: { id: report.id },
        ...withLines,
      });
    });

    return NextResponse.json({
      ...serializeStats(mealsRecord),
      newVolunteers,
    });
  } catch (error) {
    console.error("Error updating meals served:", error);
    return NextResponse.json(
      { error: "Failed to update meals served" },
      { status: 500 }
    );
  }
}
