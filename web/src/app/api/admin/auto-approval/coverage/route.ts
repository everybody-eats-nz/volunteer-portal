import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import { previewCoverage, getLiveRules, toRuleConfig } from "@/lib/auto-approval/service";
import type { RuleConfig, ShiftContext } from "@/lib/auto-approval/types";
import {
  draftToRuleConfig,
  ruleInputSchema,
} from "@/lib/auto-approval/admin-rules";

const bodySchema = z.object({
  shiftTypeId: z.string().min(1),
  location: z.string().nullish(),
  daysInAdvance: z.number().int().min(0).max(365).default(7),
  /** Roster is 10k+, so the volunteer list is always paged and filtered server-side. */
  outcome: z.enum(["APPROVED", "BLOCKED", "HELD"]).nullish(),
  search: z.string().max(120).nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  /**
   * Which rules to run:
   *  - "live"  : every enabled rule, i.e. what would really happen
   *  - "rule"  : one saved rule on its own (pass ruleId)
   *  - "draft" : an unsaved rule from the editor (pass draft)
   */
  mode: z.enum(["live", "rule", "draft"]).default("live"),
  ruleId: z.string().nullish(),
  draft: ruleInputSchema.partial().nullish(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Answers "who does this approve?" before anyone signs up. Runs the real
 * evaluator over the whole active volunteer roster against a hypothetical
 * shift, so the preview cannot disagree with production behaviour.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const shiftType = await prisma.shiftType.findUnique({
    where: { id: body.shiftTypeId },
    select: { id: true, name: true },
  });
  if (!shiftType) {
    return NextResponse.json({ error: "Unknown shift type" }, { status: 400 });
  }

  let rules: RuleConfig[];
  if (body.mode === "live") {
    rules = await getLiveRules();
  } else if (body.mode === "rule") {
    if (!body.ruleId) {
      return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
    }
    const rule = await prisma.autoAcceptRule.findUnique({
      where: { id: body.ruleId },
    });
    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    rules = [toRuleConfig(rule)];
  } else {
    rules = [draftToRuleConfig(body.draft ?? {})];
  }

  const shift: ShiftContext = {
    shiftId: null,
    shiftTypeId: shiftType.id,
    shiftTypeName: shiftType.name,
    location: body.location ?? null,
    start: new Date(Date.now() + body.daysInAdvance * DAY_MS),
    daysInAdvance: body.daysInAdvance,
  };

  const result = await previewCoverage({
    rules,
    shift,
    outcome: body.outcome ?? undefined,
    search: body.search ?? undefined,
    page: body.page,
    pageSize: body.pageSize,
  });

  return NextResponse.json({
    shift: { ...shift, start: shift.start.toISOString() },
    summary: result.summary,
    byRule: result.byRule,
    matched: result.matched,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
    volunteers: result.volunteers.map(({ snapshot, decision }) => ({
      userId: snapshot.userId,
      name: snapshot.name,
      email: snapshot.email,
      profilePhotoUrl: snapshot.profilePhotoUrl,
      volunteerGrade: snapshot.volunteerGrade,
      completedShifts: snapshot.completedShifts,
      attendanceRate: Math.round(snapshot.attendanceRate),
      labelIds: snapshot.labelIds,
      outcome: decision.outcome,
      ruleId: decision.rule?.id ?? null,
      ruleName: decision.rule?.name ?? null,
      summary: decision.summary,
      trace: decision.trace,
    })),
  });
}
