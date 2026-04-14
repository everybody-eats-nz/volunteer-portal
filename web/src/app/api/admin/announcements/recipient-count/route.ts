import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/announcements/recipient-count
 *
 * Returns how many volunteers would receive an announcement
 * with the given targeting filters. Does not create any records.
 *
 * Body: { targetLocations?, targetGrades?, targetLabelIds? }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { targetLocations = [], targetGrades = [], targetLabelIds = [] } = body;

  const where: Record<string, unknown> = { role: "VOLUNTEER" };

  if (Array.isArray(targetLocations) && targetLocations.length > 0) {
    where.OR = targetLocations.map((loc: string) => ({
      availableLocations: { contains: loc },
    }));
  }

  if (Array.isArray(targetGrades) && targetGrades.length > 0) {
    where.volunteerGrade = { in: targetGrades };
  }

  if (Array.isArray(targetLabelIds) && targetLabelIds.length > 0) {
    where.customLabels = {
      some: { labelId: { in: targetLabelIds } },
    };
  }

  const count = await prisma.user.count({ where });

  return NextResponse.json({ count });
}
