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

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "50"),
    200
  );

  const logs = await prisma.archiveLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } },
      actor: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({ logs });
}
