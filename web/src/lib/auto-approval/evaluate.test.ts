import { describe, expect, it } from "vitest";
import { evaluate, ruleScope, sortRules } from "./evaluate";
import { describeRule } from "./criteria";
import type {
  DescribeContext,
  RuleConfig,
  ShiftContext,
  VolunteerSnapshot,
} from "./types";

const ctx: DescribeContext = {
  labelNames: new Map([
    ["label-trusted", { name: "Trusted", icon: "⭐" }],
    ["label-watch", { name: "Watch", icon: "👀" }],
  ]),
};

const shift: ShiftContext = {
  shiftId: "shift-1",
  shiftTypeId: "type-kitchen",
  shiftTypeName: "Kitchen Prep",
  location: "Wellington",
  start: new Date("2026-09-01T18:00:00Z"),
  daysInAdvance: 10,
};

function rule(overrides: Partial<RuleConfig> = {}): RuleConfig {
  return {
    id: "rule-1",
    name: "Rule 1",
    kind: "APPROVE",
    priority: 0,
    global: true,
    shiftTypeId: null,
    location: null,
    minVolunteerGrade: null,
    minCompletedShifts: null,
    minAttendanceRate: null,
    minAccountAgeDays: null,
    maxDaysInAdvance: null,
    requireShiftTypeExperience: false,
    minVolunteerAge: null,
    maxVolunteerAge: null,
    requiredLabelIds: [],
    criteriaLogic: "AND",
    ...overrides,
  };
}

function volunteer(overrides: Partial<VolunteerSnapshot> = {}): VolunteerSnapshot {
  return {
    userId: "user-1",
    name: "Aroha",
    email: "aroha@example.com",
    profilePhotoUrl: null,
    volunteerGrade: "GREEN",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    accountAgeDays: 200,
    completedShifts: 10,
    canceledShifts: 0,
    attendanceRate: 100,
    age: 30,
    labelIds: [],
    hasShiftTypeExperience: true,
    ...overrides,
  };
}

describe("ruleScope", () => {
  it("lets a global rule cover any shift type", () => {
    expect(ruleScope(rule({ global: true }), shift)).toEqual({ applies: true });
  });

  it("rejects a rule scoped to a different shift type", () => {
    const scope = ruleScope(
      rule({ global: false, shiftTypeId: "type-dishes" }),
      shift
    );
    expect(scope.applies).toBe(false);
  });

  it("rejects a rule scoped to a different location", () => {
    const scope = ruleScope(rule({ location: "Auckland" }), shift);
    expect(scope).toEqual({ applies: false, reason: "only applies at Auckland" });
  });

  it("lets a location-scoped rule through at its own location", () => {
    expect(ruleScope(rule({ location: "Wellington" }), shift)).toEqual({
      applies: true,
    });
  });

  it("does not let a location-scoped rule bypass its shift type", () => {
    const scope = ruleScope(
      rule({ global: false, shiftTypeId: "type-dishes", location: "Wellington" }),
      shift
    );
    expect(scope.applies).toBe(false);
  });
});

describe("evaluate", () => {
  it("approves when every AND condition is met", () => {
    const decision = evaluate(
      [rule({ minCompletedShifts: 5, minAttendanceRate: 80 })],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("APPROVED");
    expect(decision.rule?.id).toBe("rule-1");
    expect(decision.trace[0].decisive).toBe(true);
  });

  it("holds when one AND condition fails", () => {
    const decision = evaluate(
      [rule({ minCompletedShifts: 5, minAttendanceRate: 80 })],
      volunteer({ attendanceRate: 60 }),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("HELD");
    expect(decision.rule).toBeNull();
  });

  it("approves on a single met condition under OR logic", () => {
    const decision = evaluate(
      [
        rule({
          criteriaLogic: "OR",
          minCompletedShifts: 500,
          minAttendanceRate: 80,
        }),
      ],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("APPROVED");
  });

  it("records why each condition passed or failed", () => {
    const decision = evaluate(
      [rule({ minCompletedShifts: 25 })],
      volunteer({ completedShifts: 10 }),
      shift,
      ctx
    );
    const criterion = decision.trace[0].criteria[0];
    expect(criterion.requirement).toBe("at least 25 completed shifts");
    expect(criterion.actual).toBe("10 completed shifts");
    expect(criterion.passed).toBe(false);
  });

  it("never lets a rule with no conditions match", () => {
    const decision = evaluate([rule()], volunteer(), shift, ctx);
    expect(decision.outcome).toBe("HELD");
    expect(decision.trace[0].status).toBe("NO_CRITERIA");
  });

  it("takes the highest-priority matching approval rule", () => {
    const decision = evaluate(
      [
        rule({ id: "low", name: "Low", priority: 1, minCompletedShifts: 1 }),
        rule({ id: "high", name: "High", priority: 9, minCompletedShifts: 1 }),
      ],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.rule?.id).toBe("high");
  });

  it("keeps evaluating lower-priority rules when the top one misses", () => {
    const decision = evaluate(
      [
        rule({ id: "strict", name: "Strict", priority: 9, minCompletedShifts: 99 }),
        rule({ id: "lenient", name: "Lenient", priority: 1, minCompletedShifts: 1 }),
      ],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("APPROVED");
    expect(decision.rule?.id).toBe("lenient");
  });

  it("leaves approvals alone when a block rule doesn't match", () => {
    const decision = evaluate(
      [
        rule({ id: "approve", name: "Approve all", priority: 99, minCompletedShifts: 1 }),
        rule({
          id: "block",
          name: "Under 18 needs a person",
          kind: "BLOCK",
          priority: 0,
          minVolunteerAge: 18,
        }),
      ],
      volunteer({ age: 15 }),
      shift,
      ctx
    );
    // Conditions always describe who the rule *matches*, blocks included - so
    // "18 or over" on a block catches adults, not minors. This 15-year-old
    // doesn't match the block, so the approval rule decides.
    expect(decision.outcome).toBe("APPROVED");
  });

  it("blocks the volunteers a block rule actually matches", () => {
    const decision = evaluate(
      [
        rule({ id: "approve", name: "Approve all", priority: 99, minCompletedShifts: 1 }),
        rule({
          id: "block",
          name: "Manual review",
          kind: "BLOCK",
          requiredLabelIds: ["label-watch"],
        }),
      ],
      volunteer({ labelIds: ["label-watch"] }),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("BLOCKED");
    expect(decision.rule?.name).toBe("Manual review");
    expect(decision.summary).toContain("Manual review");
  });

  it("approves a tagged volunteer who meets nothing else", () => {
    const decision = evaluate(
      [rule({ requiredLabelIds: ["label-trusted"] })],
      volunteer({
        completedShifts: 0,
        attendanceRate: 0,
        accountAgeDays: 0,
        labelIds: ["label-trusted"],
      }),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("APPROVED");
    expect(decision.trace[0].criteria[0].actual).toBe("tagged ⭐ Trusted");
  });

  it("does not approve an untagged volunteer on a tag rule", () => {
    const decision = evaluate(
      [rule({ requiredLabelIds: ["label-trusted"] })],
      volunteer({ labelIds: [] }),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("HELD");
    expect(decision.trace[0].criteria[0].actual).toBe("no tags");
  });

  it("fails the age check when no date of birth is on file", () => {
    const decision = evaluate(
      [rule({ minVolunteerAge: 18 })],
      volunteer({ age: null }),
      shift,
      ctx
    );
    expect(decision.outcome).toBe("HELD");
    expect(decision.trace[0].criteria[0].actual).toBe("no date of birth on file");
  });

  it("marks out-of-scope rules rather than silently dropping them", () => {
    const decision = evaluate(
      [rule({ location: "Auckland", minCompletedShifts: 1 })],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.trace[0].status).toBe("OUT_OF_SCOPE");
    expect(decision.summary).toBe("No approval rule covers this shift");
  });

  it("honours the lead-time condition", () => {
    const decision = evaluate(
      [rule({ maxDaysInAdvance: 3 })],
      volunteer(),
      { ...shift, daysInAdvance: 10 },
      ctx
    );
    expect(decision.outcome).toBe("HELD");
    expect(decision.trace[0].criteria[0].actual).toBe("shift starts in 10 days");
  });

  it("names the closest rule when nothing matches", () => {
    const decision = evaluate(
      [
        rule({ id: "far", name: "Far", minCompletedShifts: 99, minAttendanceRate: 99, minVolunteerAge: 99 }),
        rule({ id: "near", name: "Near", minCompletedShifts: 99 }),
      ],
      volunteer(),
      shift,
      ctx
    );
    expect(decision.summary).toContain("Near");
  });

  it("reports having no rules at all", () => {
    const decision = evaluate([], volunteer(), shift, ctx);
    expect(decision.outcome).toBe("HELD");
    expect(decision.summary).toBe("No approval rules are set up");
  });
});

describe("describeRule", () => {
  it("renders every set condition in plain English", () => {
    expect(
      describeRule(
        rule({
          minVolunteerGrade: "YELLOW",
          minCompletedShifts: 5,
          minAttendanceRate: 85,
          minAccountAgeDays: 30,
          maxDaysInAdvance: 14,
          minVolunteerAge: 18,
          requireShiftTypeExperience: true,
          requiredLabelIds: ["label-trusted"],
        }),
        ctx
      )
    ).toEqual([
      "tagged ⭐ Trusted",
      "🟡 Experienced or higher",
      "at least 18 years old",
      "signed up at least 30 days ago",
      "at least 5 completed shifts",
      "85% attendance or better",
      "has worked this shift type before",
      "shift starts within 14 days",
    ]);
  });

  it("says nothing about conditions that aren't set", () => {
    expect(describeRule(rule({ minCompletedShifts: 3 }), ctx)).toEqual([
      "at least 3 completed shifts",
    ]);
  });
});

describe("sortRules", () => {
  it("orders by priority then name", () => {
    const sorted = sortRules([
      { priority: 1, name: "B" },
      { priority: 5, name: "Z" },
      { priority: 1, name: "A" },
    ]);
    expect(sorted.map((r) => r.name)).toEqual(["Z", "A", "B"]);
  });
});
