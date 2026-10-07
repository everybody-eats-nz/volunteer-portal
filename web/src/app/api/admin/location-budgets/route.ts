import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const yearSchema = z.coerce.number().int().min(2000).max(2100);

const budgetSchema = z.object({
  locationId: z.string().min(1),
  year: yearSchema,
  annualTarget: z.coerce
    .number()
    .positive("Annual target must be more than $0")
    .max(100_000_000),
  plannedServiceNights: z.coerce
    .number()
    .int("Planned service nights must be a whole number")
    .min(1, "Plan at least one service night")
    .max(366, "A year has at most 366 nights"),
});

const deleteSchema = z.object({
  locationId: z.string().min(1),
  year: yearSchema,
});

function serialize(budget: {
  id: string;
  locationId: string;
  year: number;
  annualTarget: unknown;
  plannedServiceNights: number;
  updatedAt: Date;
}) {
  return {
    id: budget.id,
    locationId: budget.locationId,
    year: budget.year,
    annualTarget: Number(budget.annualTarget),
    plannedServiceNights: budget.plannedServiceNights,
    updatedAt: budget.updatedAt.toISOString(),
  };
}

// PUT - Create or replace a location's budget for one year
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const parsed = budgetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }
    const { locationId, year, plannedServiceNights } = parsed.data;
    const annualTarget = Math.round(parsed.data.annualTarget * 100) / 100;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    });
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    const budget = await prisma.locationBudget.upsert({
      where: { locationId_year: { locationId, year } },
      create: {
        locationId,
        year,
        annualTarget,
        plannedServiceNights,
        updatedBy: session.user.id,
      },
      update: {
        annualTarget,
        plannedServiceNights,
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json(serialize(budget));
  } catch (error) {
    console.error("Error saving location budget:", error);
    return NextResponse.json(
      { error: "Failed to save budget" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a location's budget for one year
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const parsed = deleteSchema.safeParse({
      locationId: searchParams.get("locationId"),
      year: searchParams.get("year"),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { count } = await prisma.locationBudget.deleteMany({
      where: parsed.data,
    });
    if (count === 0) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting location budget:", error);
    return NextResponse.json(
      { error: "Failed to remove budget" },
      { status: 500 }
    );
  }
}
