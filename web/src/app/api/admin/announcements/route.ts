import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/announcements
 *
 * Returns all announcements with author info and interaction counts.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({
    include: {
      author: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Count total recipients for each announcement
  const results = await Promise.all(
    announcements.map(async (ann) => {
      const recipientCount = await countRecipients(
        ann.targetLocations,
        ann.targetGrades,
        ann.targetLabelIds
      );
      return {
        ...ann,
        createdAt: ann.createdAt.toISOString(),
        expiresAt: ann.expiresAt?.toISOString() ?? null,
        recipientCount,
      };
    })
  );

  return NextResponse.json({ announcements: results });
}

/**
 * POST /api/admin/announcements
 *
 * Creates a new announcement.
 * Body: { title, body, imageUrl?, expiresAt?, targetLocations?, targetGrades?, targetLabelIds? }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  });
  if (!adminUser) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, body: announcementBody, imageUrl, expiresAt, targetLocations, targetGrades, targetLabelIds } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!announcementBody?.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      body: announcementBody.trim(),
      imageUrl: imageUrl?.trim() || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: adminUser.id,
      targetLocations: Array.isArray(targetLocations) ? targetLocations : [],
      targetGrades: Array.isArray(targetGrades) ? targetGrades : [],
      targetLabelIds: Array.isArray(targetLabelIds) ? targetLabelIds : [],
    },
    include: {
      author: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
  });

  const recipientCount = await countRecipients(
    announcement.targetLocations,
    announcement.targetGrades,
    announcement.targetLabelIds
  );

  return NextResponse.json({
    announcement: {
      ...announcement,
      createdAt: announcement.createdAt.toISOString(),
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
      recipientCount,
    },
  });
}

/**
 * Count how many volunteers will receive an announcement based on targeting filters.
 * Each filter dimension is OR-within, AND-across. Empty = "all" for that dimension.
 */
async function countRecipients(
  targetLocations: string[],
  targetGrades: string[],
  targetLabelIds: string[]
): Promise<number> {
  // Build where clause based on targeting
  const where: Record<string, unknown> = { role: "VOLUNTEER" };

  if (targetLocations.length > 0) {
    // availableLocations is a comma-separated string field
    where.OR = targetLocations.map((loc) => ({
      availableLocations: { contains: loc },
    }));
  }

  if (targetGrades.length > 0) {
    where.volunteerGrade = { in: targetGrades };
  }

  if (targetLabelIds.length > 0) {
    where.customLabels = {
      some: { labelId: { in: targetLabelIds } },
    };
  }

  return prisma.user.count({ where });
}
