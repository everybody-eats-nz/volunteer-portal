import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveReportTargets } from "./resolve-targets";

/**
 * Resolved reports are history: only the most recent are worth a row (and a
 * target lookup). Open reports are always returned in full, since each one
 * needs an admin.
 */
const RESOLVED_HISTORY_LIMIT = 100;

const reporterInclude = {
  reporter: {
    select: { id: true, firstName: true, name: true, email: true },
  },
} as const;

/**
 * GET /api/admin/moderation/reports
 * Returns every open (pending or reviewed) report plus the latest resolved
 * ones, newest first, each with `target`: what was reported (a snippet), who
 * wrote it, and where to look at it.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [open, resolved] = await Promise.all([
    prisma.contentReport.findMany({
      where: { status: { not: "RESOLVED" } },
      include: reporterInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentReport.findMany({
      where: { status: "RESOLVED" },
      include: reporterInclude,
      orderBy: { createdAt: "desc" },
      take: RESOLVED_HISTORY_LIMIT,
    }),
  ]);
  const reports = [...open, ...resolved].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const targets = await resolveReportTargets(reports);

  return NextResponse.json({
    resolvedHistoryLimit: RESOLVED_HISTORY_LIMIT,
    reports: reports.map((report) => ({
      ...report,
      target: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
    })),
  });
}
