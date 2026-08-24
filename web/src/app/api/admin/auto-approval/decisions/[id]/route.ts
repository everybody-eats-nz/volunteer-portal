import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";

/**
 * One decision's stored reasoning. Kept off the list response because a trace
 * runs to a couple of KB per row and most are never opened.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const decision = await prisma.autoApprovalDecision.findUnique({
    where: { id },
    select: { id: true, trace: true, stats: true },
  });

  if (!decision) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  return NextResponse.json({ decision });
}
