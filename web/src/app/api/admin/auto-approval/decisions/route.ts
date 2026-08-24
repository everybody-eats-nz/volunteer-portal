import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { listSafePhotoUrl, requireAdmin } from "@/lib/admin-api";

const PAGE_SIZE = 25;
const OUTCOMES = ["APPROVED", "HELD", "BLOCKED", "ERROR"] as const;
type Outcome = (typeof OUTCOMES)[number];

/**
 * The audit log: every auto-approval evaluation, with the trace that says why.
 * Filters compose, and the outcome tallies are computed against the *other*
 * filters so the counts stay meaningful while you narrow down.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const outcome = params.get("outcome");
  const ruleId = params.get("ruleId");
  const location = params.get("location");
  const shiftTypeId = params.get("shiftTypeId");
  const q = params.get("q")?.trim();
  const from = params.get("from");
  const to = params.get("to");

  const shiftFilter: Prisma.ShiftWhereInput = {};
  if (location) shiftFilter.location = location;
  if (shiftTypeId) shiftFilter.shiftTypeId = shiftTypeId;

  // Everything except the outcome filter, so the tallies show what selecting a
  // different outcome would give you.
  const baseWhere: Prisma.AutoApprovalDecisionWhereInput = {
    ...(ruleId ? { ruleId } : {}),
    ...(Object.keys(shiftFilter).length ? { shift: shiftFilter } : {}),
    ...(q
      ? {
          user: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const where: Prisma.AutoApprovalDecisionWhereInput = {
    ...baseWhere,
    ...(outcome && OUTCOMES.includes(outcome as Outcome)
      ? { outcome: outcome as Outcome }
      : {}),
  };

  const [decisions, total, tallies] = await Promise.all([
    prisma.autoApprovalDecision.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      // `trace` and `stats` are deliberately not selected: each is a couple of
      // KB and a page of 25 would be mostly reasoning nobody has asked to see
      // yet. The receipt is fetched per row when it's expanded.
      select: {
        id: true,
        createdAt: true,
        outcome: true,
        ruleName: true,
        summary: true,
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            volunteerGrade: true,
          },
        },
        shift: {
          select: {
            id: true,
            start: true,
            end: true,
            location: true,
            shiftType: { select: { id: true, name: true } },
          },
        },
        signup: { select: { id: true, status: true } },
        rule: { select: { id: true, name: true, kind: true, archivedAt: true } },
      },
    }),
    prisma.autoApprovalDecision.count({ where }),
    prisma.autoApprovalDecision.groupBy({
      by: ["outcome"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    decisions: decisions.map((d) => ({
      ...d,
      user: { ...d.user, profilePhotoUrl: listSafePhotoUrl(d.user.profilePhotoUrl) },
    })),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    tallies: Object.fromEntries(
      OUTCOMES.map((o) => [
        o,
        tallies.find((t) => t.outcome === o)?._count._all ?? 0,
      ])
    ),
  });
}
