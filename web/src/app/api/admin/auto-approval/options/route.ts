import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { getActiveLocationNames } from "@/lib/locations";

/**
 * Everything the admin screens need to render pickers: shift types, locations
 * and the volunteer tags that drive per-person overrides. Tag counts are
 * included so an admin can see how many people a tag-based rule covers without
 * running a preview.
 */
export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const [shiftTypes, locations, labels] = await Promise.all([
    prisma.shiftType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getActiveLocationNames(),
    prisma.customLabel.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    shiftTypes,
    locations,
    labels: labels.map((l) => ({
      id: l.id,
      name: l.name,
      icon: l.icon,
      color: l.color,
      volunteerCount: l._count.users,
    })),
  });
}
