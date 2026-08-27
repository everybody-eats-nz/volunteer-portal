import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { archiveUser } from "@/lib/archive-service";
import { ArchiveReason, ArchiveTriggerSource } from "@/generated/client";

const bodySchema = z.object({
  // Optional so this route can serve any caller that archives a single user,
  // not just the admin dialog. The dialog always sends MANUAL; a caller that
  // archives on a rule's behalf (e.g. a targeted re-run of an automated
  // category) passes that category's reason instead. Defaults to MANUAL below.
  reason: z.nativeEnum(ArchiveReason).optional(),
  note: z.string().max(500).optional(),
});

/**
 * Impact preview for the manual archive dialog. Archiving blocks sign-in, so
 * admins need to see what the volunteer is still booked on before they commit.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const now = new Date();

  const [upcomingConfirmed, upcomingPending, activeRegulars] =
    await Promise.all([
      prisma.signup.count({
        where: {
          userId,
          status: "CONFIRMED",
          shift: { start: { gte: now } },
        },
      }),
      prisma.signup.count({
        where: {
          userId,
          status: { in: ["PENDING", "REGULAR_PENDING", "WAITLISTED"] },
          shift: { start: { gte: now } },
        },
      }),
      prisma.regularVolunteer.count({
        where: { userId, isActive: true, isPausedByUser: false },
      }),
    ]);

  return NextResponse.json({
    upcomingConfirmed,
    upcomingPending,
    activeRegulars,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, archivedAt: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.role !== "VOLUNTEER") {
    return NextResponse.json(
      { error: "Only volunteers can be archived" },
      { status: 400 }
    );
  }
  if (target.archivedAt) {
    return NextResponse.json(
      { error: "User is already archived" },
      { status: 400 }
    );
  }

  await archiveUser({
    userId,
    reason: parsed.data.reason ?? ArchiveReason.MANUAL,
    triggerSource: ArchiveTriggerSource.MANUAL,
    actorId: session.user.id,
    note: parsed.data.note,
  });

  return NextResponse.json({ ok: true });
}
