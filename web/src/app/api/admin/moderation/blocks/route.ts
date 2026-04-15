import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/moderation/blocks
 * Returns all user blocks, newest first.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const blocks = await prisma.userBlock.findMany({
    include: {
      blocker: {
        select: { id: true, firstName: true, name: true, email: true },
      },
      blocked: {
        select: { id: true, firstName: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ blocks });
}
