import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";

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

  const conditions: Prisma.Sql[] = [Prisma.sql`role = 'VOLUNTEER'`];

  if (Array.isArray(targetLocations) && targetLocations.length > 0) {
    conditions.push(
      Prisma.sql`"defaultLocation" = ANY(ARRAY[${Prisma.join(targetLocations as string[])}]::text[])`
    );
  }

  if (Array.isArray(targetGrades) && targetGrades.length > 0) {
    conditions.push(
      Prisma.sql`"volunteerGrade"::text = ANY(ARRAY[${Prisma.join(targetGrades as string[])}]::text[])`
    );
  }

  if (Array.isArray(targetLabelIds) && targetLabelIds.length > 0) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "UserCustomLabel"
        WHERE "userId" = id
        AND "labelId" = ANY(ARRAY[${Prisma.join(targetLabelIds as string[])}]::text[])
      )`
    );
  }

  const result = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`SELECT COUNT(*) AS count FROM "User" WHERE ${Prisma.join(conditions, " AND ")}`
  );

  return NextResponse.json({ count: Number(result[0].count) });
}
