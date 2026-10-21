import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveReportTargets } from "./resolve-targets";

/**
 * GET /api/admin/moderation/reports
 * Returns all content reports, newest first, each with `target`: what was
 * reported (a snippet), who wrote it, and where to look at it.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const reports = await prisma.contentReport.findMany({
    include: {
      reporter: {
        select: { id: true, firstName: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const targets = await resolveReportTargets(reports);

  return NextResponse.json({
    reports: reports.map((report) => ({
      ...report,
      target: targets.get(`${report.targetType}:${report.targetId}`) ?? null,
    })),
  });
}
