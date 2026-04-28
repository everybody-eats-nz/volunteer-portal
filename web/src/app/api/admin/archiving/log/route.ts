import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pageSize = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("pageSize") ?? "50"), 1),
    200
  );
  const page = Math.max(
    Number(req.nextUrl.searchParams.get("page") ?? "1"),
    1
  );

  const [logs, total] = await Promise.all([
    prisma.archiveLog.findMany({
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } },
        actor: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.archiveLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, pageSize });
}
