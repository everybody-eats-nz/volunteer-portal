import { traceCriteria, activeCriteria } from "./criteria";
import type {
  Decision,
  DescribeContext,
  RuleConfig,
  RuleTrace,
  ShiftContext,
  VolunteerSnapshot,
} from "./types";

/**
 * Does this rule cover this shift at all, before we look at the volunteer?
 * A global rule covers every shift type; a rule with no location covers every
 * location.
 */
export function ruleScope(
  rule: Pick<RuleConfig, "global" | "shiftTypeId" | "location">,
  shift: Pick<ShiftContext, "shiftTypeId" | "location">
): { applies: true } | { applies: false; reason: string } {
  if (!rule.global && rule.shiftTypeId !== shift.shiftTypeId) {
    return { applies: false, reason: "different shift type" };
  }
  if (rule.location !== null && rule.location !== shift.location) {
    return { applies: false, reason: `only applies at ${rule.location}` };
  }
  return { applies: true };
}

function traceRule(
  rule: RuleConfig,
  snapshot: VolunteerSnapshot,
  shift: ShiftContext,
  ctx: DescribeContext
): RuleTrace {
  const base = {
    ruleId: rule.id,
    ruleName: rule.name,
    kind: rule.kind,
    priority: rule.priority,
    logic: rule.criteriaLogic,
    decisive: false,
  };

  const scope = ruleScope(rule, shift);
  if (!scope.applies) {
    return { ...base, status: "OUT_OF_SCOPE", scopeReason: scope.reason, criteria: [] };
  }

  // A rule with nothing to check would match everyone, which is never what an
  // admin meant - treat it as inert and say so.
  if (activeCriteria(rule).length === 0) {
    return { ...base, status: "NO_CRITERIA", criteria: [] };
  }

  const criteria = traceCriteria(rule, snapshot, shift, ctx);
  const matched =
    rule.criteriaLogic === "AND"
      ? criteria.every((c) => c.passed)
      : criteria.some((c) => c.passed);

  return { ...base, status: matched ? "MATCHED" : "NOT_MATCHED", criteria };
}

/** Highest priority first; ties broken by name so the order is stable. */
export function sortRules<T extends Pick<RuleConfig, "priority" | "name">>(
  rules: T[]
): T[] {
  return [...rules].sort(
    (a, b) => b.priority - a.priority || a.name.localeCompare(b.name)
  );
}

/**
 * Outcome only - no per-criterion strings built. The full trace is what makes
 * a decision explainable, but building it for every volunteer in a 10k roster
 * is wasted work when all the caller needs is a tally. Use this to count, then
 * `evaluate` the handful of rows you are actually going to show.
 */
export function evaluateOutcome(
  rules: RuleConfig[],
  snapshot: VolunteerSnapshot,
  shift: ShiftContext
): { outcome: "APPROVED" | "BLOCKED" | "HELD"; rule: RuleConfig | null } {
  const matches = (rule: RuleConfig) => {
    if (!ruleScope(rule, shift).applies) return false;
    const criteria = activeCriteria(rule);
    if (criteria.length === 0) return false;
    return rule.criteriaLogic === "AND"
      ? criteria.every((c) => c.passes(rule, snapshot, shift))
      : criteria.some((c) => c.passes(rule, snapshot, shift));
  };

  const blocked = sortRules(rules.filter((r) => r.kind === "BLOCK")).find(matches);
  if (blocked) return { outcome: "BLOCKED", rule: blocked };

  const approved = sortRules(rules.filter((r) => r.kind === "APPROVE")).find(matches);
  if (approved) return { outcome: "APPROVED", rule: approved };

  return { outcome: "HELD", rule: null };
}

/**
 * Evaluates every rule and reports on all of them, so the trace explains not
 * just the decision but every rule that could plausibly have made a different
 * one.
 *
 * BLOCK rules are checked first and win outright: a volunteer flagged for
 * manual review stays pending no matter how many APPROVE rules they satisfy.
 * Among APPROVE rules, the highest-priority match wins.
 */
export function evaluate(
  rules: RuleConfig[],
  snapshot: VolunteerSnapshot,
  shift: ShiftContext,
  ctx: DescribeContext
): Decision {
  const blocks = sortRules(rules.filter((r) => r.kind === "BLOCK"));
  const approves = sortRules(rules.filter((r) => r.kind === "APPROVE"));

  const blockTraces = blocks.map((r) => traceRule(r, snapshot, shift, ctx));
  const approveTraces = approves.map((r) => traceRule(r, snapshot, shift, ctx));
  const trace = [...blockTraces, ...approveTraces];

  const blocked = blockTraces.find((t) => t.status === "MATCHED");
  if (blocked) {
    blocked.decisive = true;
    return {
      outcome: "BLOCKED",
      rule: { id: blocked.ruleId, name: blocked.ruleName, kind: "BLOCK" },
      summary: `Held for review by "${blocked.ruleName}"`,
      trace,
      snapshot,
      shift,
    };
  }

  const approved = approveTraces.find((t) => t.status === "MATCHED");
  if (approved) {
    approved.decisive = true;
    return {
      outcome: "APPROVED",
      rule: { id: approved.ruleId, name: approved.ruleName, kind: "APPROVE" },
      summary: `Approved by "${approved.ruleName}"`,
      trace,
      snapshot,
      shift,
    };
  }

  const inScope = approveTraces.filter((t) => t.status === "NOT_MATCHED");
  return {
    outcome: "HELD",
    rule: null,
    summary: inScope.length
      ? `No rule matched - closest was "${closestRule(inScope)}"`
      : approves.length
        ? "No approval rule covers this shift"
        : "No approval rules are set up",
    trace,
    snapshot,
    shift,
  };
}

/** The in-scope rule that came nearest to matching, for the one-line summary. */
function closestRule(traces: RuleTrace[]): string {
  let best = traces[0];
  let bestMisses = Infinity;
  for (const t of traces) {
    const misses = t.criteria.filter((c) => !c.passed).length;
    if (misses < bestMisses) {
      best = t;
      bestMisses = misses;
    }
  }
  return best.ruleName;
}
