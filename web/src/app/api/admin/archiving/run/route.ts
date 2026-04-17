import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import {
  runArchivePasses,
  archiveUser,
  sendInactiveWarning,
  sendFirstShiftNudge,
} from "@/lib/archive-service";
import { ArchiveReason, ArchiveTriggerSource } from "@/generated/client";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("run-all") }),
  z.object({
    action: z.literal("archive"),
    userId: z.string(),
    reason: z.nativeEnum(ArchiveReason),
  }),
  z.object({ action: z.literal("warn"), userId: z.string() }),
  z.object({ action: z.literal("nudge"), userId: z.string() }),
]);

/**
 * POST /api/admin/archiving/run
 * Runs the full archive pipeline or a single action on a specific user.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }

  const actorId = session.user.id;

  if (parsed.data.action === "run-all") {
    const report = await runArchivePasses(ArchiveTriggerSource.MANUAL, actorId);
    return NextResponse.json({ ok: true, report });
  }

  if (parsed.data.action === "archive") {
    await archiveUser({
      userId: parsed.data.userId,
      reason: parsed.data.reason,
      triggerSource: ArchiveTriggerSource.MANUAL,
      actorId,
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "warn") {
    await sendInactiveWarning({
      userId: parsed.data.userId,
      triggerSource: ArchiveTriggerSource.MANUAL,
      actorId,
    });
    return NextResponse.json({ ok: true });
  }

  await sendFirstShiftNudge({
    userId: parsed.data.userId,
    triggerSource: ArchiveTriggerSource.MANUAL,
    actorId,
  });
  return NextResponse.json({ ok: true });
}
