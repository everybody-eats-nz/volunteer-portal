import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

/**
 * GET /api/cron/prune-chat-logs
 *
 * Deletes ChatLog rows older than 30 days. Runs daily.
 * Secured via CRON_SECRET (automatically set by Vercel).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const { count } = await prisma.chatLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  console.log(`[cron] Pruned ${count} ChatLog rows older than ${RETENTION_DAYS} days`);

  return NextResponse.json({ pruned: count, cutoff: cutoff.toISOString() });
}
