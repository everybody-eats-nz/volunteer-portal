import { prisma } from "@/lib/prisma";
import type { AutoAcceptRule, Prisma } from "@/generated/client";
import { createShiftConfirmedNotification } from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";
import { formatInNZT } from "@/lib/timezone";
import { autoCancelOtherPendingSignupsForDay } from "@/lib/signup-utils.server";
import { isFirstConfirmedShift } from "@/lib/shift-helpers";
import { evaluate, evaluateOutcome } from "./evaluate";
import {
  buildShiftContext,
  getDescribeContext,
  getVolunteerSnapshot,
  getVolunteerSnapshots,
} from "./snapshot";
import type {
  Decision,
  DescribeContext,
  RuleConfig,
  ShiftContext,
  VolunteerSnapshot,
} from "./types";

/** Narrows a database rule to the shape the evaluator needs. */
export function toRuleConfig(rule: AutoAcceptRule): RuleConfig {
  return {
    id: rule.id,
    name: rule.name,
    kind: rule.kind,
    priority: rule.priority,
    global: rule.global,
    shiftTypeId: rule.shiftTypeId,
    location: rule.location,
    minVolunteerGrade: rule.minVolunteerGrade,
    minCompletedShifts: rule.minCompletedShifts,
    minAttendanceRate: rule.minAttendanceRate,
    minAccountAgeDays: rule.minAccountAgeDays,
    maxDaysInAdvance: rule.maxDaysInAdvance,
    requireShiftTypeExperience: rule.requireShiftTypeExperience,
    minVolunteerAge: rule.minVolunteerAge,
    maxVolunteerAge: rule.maxVolunteerAge,
    requiredLabelIds: rule.requiredLabelIds,
    criteriaLogic: rule.criteriaLogic,
  };
}

/** The rules that are live right now - enabled and not archived. */
export async function getLiveRules(): Promise<RuleConfig[]> {
  const rules = await prisma.autoAcceptRule.findMany({
    where: { enabled: true, archivedAt: null },
    orderBy: { priority: "desc" },
  });
  return rules.map(toRuleConfig);
}

/**
 * Works out what would happen to this volunteer on this shift, without
 * touching anything. Returns null if the shift or volunteer is missing.
 */
export async function decide(
  userId: string,
  shiftId: string
): Promise<Decision | null> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { shiftType: { select: { name: true } } },
  });
  if (!shift) return null;

  const [snapshot, rules, ctx] = await Promise.all([
    getVolunteerSnapshot(userId, shift.shiftTypeId),
    getLiveRules(),
    getDescribeContext(),
  ]);
  if (!snapshot) return null;

  return evaluate(rules, snapshot, buildShiftContext(shift), ctx);
}

export interface CoverageOptions {
  rules: RuleConfig[];
  shift: ShiftContext;
  /** Only include volunteers with this outcome. */
  outcome?: "APPROVED" | "BLOCKED" | "HELD";
  /** Case-insensitive match on name or email. */
  search?: string;
  page?: number;
  pageSize?: number;
  /**
   * Per-criterion traces are large - every rule against every listed
   * volunteer. Lists leave them out and fetch one on demand when a row is
   * expanded; see `explainCoverage`.
   */
  includeTraces?: boolean;
}

export interface CoverageSummary {
  total: number;
  approved: number;
  blocked: number;
  held: number;
}

/**
 * Runs the given rules over the whole active roster for a hypothetical shift.
 * Same evaluator and same stats as a real signup, so the preview cannot drift
 * from production behaviour.
 *
 * The roster is 10k+ people, so the tallies are computed over everyone with
 * the trace-free fast path and only the requested page is evaluated in full.
 */
export async function previewCoverage(options: CoverageOptions): Promise<{
  summary: CoverageSummary;
  byRule: { ruleId: string; ruleName: string; outcome: string; count: number }[];
  matched: number;
  page: number;
  pageSize: number;
  totalPages: number;
  volunteers: { snapshot: VolunteerSnapshot; decision: Decision }[];
}> {
  const pageSize = options.pageSize ?? 25;
  const page = Math.max(1, options.page ?? 1);

  const snapshots = await getVolunteerSnapshots(options.shift.shiftTypeId);

  const summary: CoverageSummary = {
    total: snapshots.length,
    approved: 0,
    blocked: 0,
    held: 0,
  };
  const byRule = new Map<
    string,
    { ruleId: string; ruleName: string; outcome: string; count: number }
  >();

  const search = options.search?.trim().toLowerCase();
  const matching: VolunteerSnapshot[] = [];

  for (const snapshot of snapshots) {
    const { outcome, rule } = evaluateOutcome(
      options.rules,
      snapshot,
      options.shift
    );

    if (outcome === "APPROVED") summary.approved++;
    else if (outcome === "BLOCKED") summary.blocked++;
    else summary.held++;

    if (rule) {
      const key = `${rule.id}:${outcome}`;
      const entry = byRule.get(key) ?? {
        ruleId: rule.id,
        ruleName: rule.name,
        outcome,
        count: 0,
      };
      entry.count++;
      byRule.set(key, entry);
    }

    if (options.outcome && outcome !== options.outcome) continue;
    if (
      search &&
      !(snapshot.name ?? "").toLowerCase().includes(search) &&
      !snapshot.email.toLowerCase().includes(search)
    ) {
      continue;
    }
    matching.push(snapshot);
  }

  // Only the page being shown is decided in detail, and only when the caller
  // actually wants traces.
  const pageSnapshots = matching.slice((page - 1) * pageSize, page * pageSize);
  const ctx = options.includeTraces
    ? await getDescribeContext()
    : { labelNames: new Map() };

  return {
    summary,
    byRule: [...byRule.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    matched: matching.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
    volunteers: pageSnapshots.map((snapshot) => {
      if (options.includeTraces) {
        return { snapshot, decision: evaluate(options.rules, snapshot, options.shift, ctx) };
      }
      // Outcome and deciding rule only - enough to render the row.
      const { outcome, rule } = evaluateOutcome(
        options.rules,
        snapshot,
        options.shift
      );
      return {
        snapshot,
        decision: {
          outcome,
          rule: rule ? { id: rule.id, name: rule.name, kind: rule.kind } : null,
          summary: rule
            ? outcome === "BLOCKED"
              ? `Held for review by "${rule.name}"`
              : `Approved by "${rule.name}"`
            : "No rule matched",
          trace: [],
          snapshot,
          shift: options.shift,
        } satisfies Decision,
      };
    }),
  };
}

/**
 * The full receipt for one volunteer, fetched when an admin expands a row.
 * Reuses the cached roster, so this is in-memory work.
 */
export async function explainCoverage(options: {
  rules: RuleConfig[];
  shift: ShiftContext;
  userId: string;
}): Promise<Decision | null> {
  const [snapshots, ctx] = await Promise.all([
    getVolunteerSnapshots(options.shift.shiftTypeId),
    getDescribeContext(),
  ]);
  const snapshot = snapshots.find((s) => s.userId === options.userId);
  if (!snapshot) return null;
  return evaluate(options.rules, snapshot, options.shift, ctx);
}

/** Writes the decision to the audit log. Never throws - logging must not break signup. */
async function recordDecision(
  decision: Decision,
  context: { signupId: string; userId: string; shiftId: string }
): Promise<void> {
  try {
    await prisma.autoApprovalDecision.create({
      data: {
        signupId: context.signupId,
        userId: context.userId,
        shiftId: context.shiftId,
        outcome: decision.outcome,
        ruleId: decision.rule?.id ?? null,
        ruleName: decision.rule?.name ?? null,
        summary: decision.summary,
        trace: decision.trace as unknown as Prisma.InputJsonValue,
        stats: {
          ...decision.snapshot,
          createdAt: decision.snapshot.createdAt.toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("[auto-approval] Failed to record decision:", error);
  }
}

/**
 * Decides a freshly created PENDING signup and applies the outcome.
 * Every call leaves an audit record, including the ones that change nothing -
 * "why is this person still pending?" is a question the log has to answer.
 */
export async function processAutoApproval(
  signupId: string,
  userId: string,
  shiftId: string
): Promise<{ autoApproved: boolean; status: string; decision: Decision | null }> {
  let decision: Decision | null = null;
  try {
    decision = await decide(userId, shiftId);
  } catch (error) {
    console.error("[auto-approval] Evaluation failed:", error);
  }

  if (!decision) {
    return { autoApproved: false, status: "PENDING", decision: null };
  }

  await recordDecision(decision, { signupId, userId, shiftId });

  if (decision.outcome !== "APPROVED" || !decision.rule) {
    return { autoApproved: false, status: "PENDING", decision };
  }

  await prisma.signup.update({
    where: { id: signupId },
    data: { status: "CONFIRMED" },
  });

  await prisma.autoApproval.create({
    data: { signupId, ruleId: decision.rule.id },
  });

  await applyApprovalSideEffects(userId, shiftId);

  return { autoApproved: true, status: "CONFIRMED", decision };
}

/**
 * Everything that follows a confirmation: clearing the volunteer's other
 * pending signups that day, then notifying them. Failures here are logged but
 * never undo the approval.
 */
async function applyApprovalSideEffects(userId: string, shiftId: string) {
  try {
    const shift = await prisma.shift.findUniqueOrThrow({
      where: { id: shiftId },
      include: { shiftType: true },
    });

    try {
      await autoCancelOtherPendingSignupsForDay(userId, shiftId, shift.start);
    } catch (error) {
      console.error("[auto-approval] Error auto-canceling other signups:", error);
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, firstName: true, lastName: true },
    });

    const shiftDate = formatInNZT(shift.start, "EEEE, MMMM d, yyyy");

    // Fire-and-forget: a hung SSE writer must not block the signup response.
    createShiftConfirmedNotification(
      userId,
      shift.shiftType.name,
      shiftDate,
      shiftId
    ).catch((err) =>
      console.error("[auto-approval] Error sending confirmation notification:", err)
    );

    const isFirstShift = await isFirstConfirmedShift(userId, shiftId);
    const emailService = getEmailService();

    Promise.race([
      emailService.sendShiftConfirmationNotification({
        to: user.email,
        volunteerName:
          user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        shiftName: shift.shiftType.name,
        shiftDate,
        shiftTime: `${formatInNZT(shift.start, "h:mm a")} - ${formatInNZT(shift.end, "h:mm a")}`,
        location: shift.location || "TBD",
        shiftId,
        shiftStart: shift.start,
        shiftEnd: shift.end,
        isFirstShift,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email send timeout")), 10000)
      ),
    ]).catch((error) =>
      console.error("[auto-approval] Error sending confirmation email:", error)
    );
  } catch (error) {
    console.error("[auto-approval] Error running approval side effects:", error);
  }
}

/**
 * Read-only check used by the signup dialogs to tell a volunteer up front
 * whether they'll be confirmed instantly. Deliberately does not write to the
 * decision log - browsing a shift is not a decision.
 */
export async function checkAutoApprovalEligibility(
  userId: string,
  shiftId: string
): Promise<{ eligible: boolean; ruleName?: string }> {
  try {
    const decision = await decide(userId, shiftId);
    return {
      eligible: decision?.outcome === "APPROVED",
      ruleName: decision?.rule?.name,
    };
  } catch (error) {
    console.error("[auto-approval] Eligibility check failed:", error);
    return { eligible: false };
  }
}

export type { Decision, DescribeContext, RuleConfig, ShiftContext, VolunteerSnapshot };
