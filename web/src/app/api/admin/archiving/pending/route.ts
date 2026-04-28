import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  type ArchiveCategory,
  getInactiveArchiveCandidates,
  getInactiveWarningCandidates,
  whereNeverActivatedArchive,
  whereNeverActivatedNudge,
  whereNeverMigrated,
} from "@/lib/archive-service";

const ALLOWED: readonly ArchiveCategory[] = [
  "never-migrated",
  "never-activated-nudge",
  "never-activated-archive",
  "inactive-warning",
  "inactive-archive",
] as const;

function isCategory(v: string | null): v is ArchiveCategory {
  return v !== null && (ALLOWED as readonly string[]).includes(v);
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  name: true,
  createdAt: true,
  migrationInvitationSentAt: true,
  migrationInvitationCount: true,
} as const;

/**
 * GET /api/admin/archiving/pending?category=...
 * Returns users matching the given rule.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const category = req.nextUrl.searchParams.get("category");
  if (!isCategory(category)) {
    return NextResponse.json(
      { error: "Invalid or missing category" },
      { status: 400 }
    );
  }

  const now = new Date();

  if (category === "never-migrated") {
    const users = await prisma.user.findMany({
      where: whereNeverMigrated(),
      select: USER_SELECT,
      orderBy: { migrationInvitationSentAt: "asc" },
    });
    return NextResponse.json({ category, users });
  }

  if (category === "never-activated-nudge") {
    const users = await prisma.user.findMany({
      where: whereNeverActivatedNudge(now),
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ category, users });
  }

  if (category === "never-activated-archive") {
    const users = await prisma.user.findMany({
      where: whereNeverActivatedArchive(now),
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ category, users });
  }

  if (category === "inactive-warning") {
    const users = await getInactiveWarningCandidates(now);
    return NextResponse.json({
      category,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        name: u.name,
        createdAt: u.createdAt,
        effectiveLastActivityAt: u.effectiveLastActivityAt,
        archiveWarningSentAt: u.archiveWarningSentAt,
      })),
    });
  }

  const users = await getInactiveArchiveCandidates(now);
  return NextResponse.json({
    category,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      name: u.name,
      createdAt: u.createdAt,
      effectiveLastActivityAt: u.effectiveLastActivityAt,
      archiveWarningSentAt: u.archiveWarningSentAt,
    })),
  });
}
