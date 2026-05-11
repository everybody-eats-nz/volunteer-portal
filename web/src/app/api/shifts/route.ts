import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
} from "@/lib/placeholder-utils";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");

  const where: { start?: { gte: Date } } = {};
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      where.start = { gte: fromDate };
    }
  }

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: { start: "asc" },
    include: {
      shiftType: true,
      _count: shiftCapacityCountSelect(["CONFIRMED"]),
    },
  });

  type ShiftItem = {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    notes: string | null;
    capacity: number;
    remaining: number;
    shiftType: { id: string; name: string };
    url: string;
    image: string;
  };

  const baseUrl = getBaseUrl();
  const result: ShiftItem[] = shifts.map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    location: s.location,
    notes: s.notes,
    capacity: s.capacity,
    remaining: Math.max(0, s.capacity - getShiftEffectiveCount(s)),
    shiftType: { id: s.shiftType.id, name: s.shiftType.name },
    url: `${baseUrl}/shifts/${s.id}`,
    image: `${baseUrl}/og-image.png`,
  }));

  return NextResponse.json(result);
}
