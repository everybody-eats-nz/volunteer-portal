import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listSafePhotoUrl, requireAdmin } from "@/lib/admin-api";
import { activeCriteria } from "@/lib/auto-approval/criteria";
import { toRuleConfig } from "@/lib/auto-approval/service";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DayRow {
  day: Date;
  outcome: "APPROVED" | "HELD" | "BLOCKED" | "ERROR";
  count: bigint;
}

/**
 * The health of the whole system at a glance: how much work the rules are
 * taking off the team, whether anything is being blocked, and which rules are
 * actually doing something. Also surfaces rules that look active but can never
 * fire, which is the most common way this goes quietly wrong.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const days = Math.min(
    365,
    Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30)
  );
  const since = new Date(Date.now() - days * DAY_MS);

  const [totals, daily, byRule, byLocation, rules, overrides, recent] =
    await Promise.all([
      prisma.autoApprovalDecision.groupBy({
        by: ["outcome"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),

      prisma.$queryRaw<DayRow[]>`
        SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Pacific/Auckland') AS day,
               "outcome"::text AS outcome,
               COUNT(*) AS count
        FROM "AutoApprovalDecision"
        WHERE "createdAt" >= ${since}
        GROUP BY day, outcome
        ORDER BY day ASC
      `,

      prisma.autoApprovalDecision.groupBy({
        by: ["ruleId", "ruleName", "outcome"],
        where: { createdAt: { gte: since }, ruleId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { ruleId: "desc" } },
        take: 20,
      }),

      prisma.$queryRaw<{ location: string | null; approved: bigint; total: bigint }[]>`
        SELECT sh."location",
               COUNT(*) FILTER (WHERE d."outcome" = 'APPROVED') AS approved,
               COUNT(*) AS total
        FROM "AutoApprovalDecision" d
        JOIN "Shift" sh ON sh.id = d."shiftId"
        WHERE d."createdAt" >= ${since}
        GROUP BY sh."location"
        ORDER BY total DESC
      `,

      prisma.autoAcceptRule.findMany({
        where: { archivedAt: null },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),

      prisma.autoApproval.count({
        where: { overridden: true, approvedAt: { gte: since } },
      }),

      prisma.autoApprovalDecision.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          createdAt: true,
          outcome: true,
          ruleName: true,
          summary: true,
          user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
          shift: {
            select: {
              start: true,
              location: true,
              shiftType: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  const count = (outcome: string) =>
    totals.find((t) => t.outcome === outcome)?._count._all ?? 0;

  const approved = count("APPROVED");
  const held = count("HELD");
  const blocked = count("BLOCKED");
  const errored = count("ERROR");
  const total = approved + held + blocked + errored;

  // A rule with no conditions matches nobody; a disabled one is off on
  // purpose. Both are worth calling out before an admin wonders why nothing
  // is being approved.
  const inertRules = rules
    .filter((r) => activeCriteria(toRuleConfig(r)).length === 0)
    .map((r) => ({ id: r.id, name: r.name }));

  return NextResponse.json({
    windowDays: days,
    totals: { total, approved, held, blocked, errored },
    autoApprovalRate: total > 0 ? (approved / total) * 100 : 0,
    overrides,
    series: buildSeries(daily, days),
    // Carries the outcome so the UI can colour each bar by what the rule
    // actually did - a block rule racking up numbers is not "work done", it's
    // people being held.
    byRule: byRule
      .map((r) => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName ?? "Deleted rule",
        outcome: r.outcome,
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    byLocation: byLocation.map((l) => ({
      location: l.location ?? "Unassigned",
      approved: Number(l.approved),
      total: Number(l.total),
    })),
    ruleHealth: {
      enabled: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
      blocking: rules.filter((r) => r.kind === "BLOCK" && r.enabled).length,
      inert: inertRules,
    },
    recent: recent.map((d) => ({
      ...d,
      user: { ...d.user, profilePhotoUrl: listSafePhotoUrl(d.user.profilePhotoUrl) },
    })),
  });
}

/** Zero-fills the daily series so the chart has no gaps. */
function buildSeries(rows: DayRow[], days: number) {
  const byDay = new Map<string, { approved: number; held: number; blocked: number }>();
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { approved: 0, held: 0, blocked: 0 };
    const n = Number(row.count);
    if (row.outcome === "APPROVED") entry.approved += n;
    else if (row.outcome === "BLOCKED") entry.blocked += n;
    else if (row.outcome === "HELD") entry.held += n;
    byDay.set(key, entry);
  }

  const series: {
    date: string;
    approved: number;
    held: number;
    blocked: number;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    series.push({ date, ...(byDay.get(date) ?? { approved: 0, held: 0, blocked: 0 }) });
  }
  return series;
}
