import type { CriteriaLogic, VolunteerGrade } from "@/generated/client";

/**
 * The shape every rule-like object must satisfy to be evaluated. Saved rules
 * from the database satisfy it, and so do unsaved drafts coming out of the
 * rule editor - which is what lets the editor preview a rule before it exists.
 */
export interface RuleConfig {
  id: string;
  name: string;
  kind: "APPROVE" | "BLOCK";
  priority: number;
  global: boolean;
  shiftTypeId: string | null;
  location: string | null;

  minVolunteerGrade: VolunteerGrade | null;
  minCompletedShifts: number | null;
  minAttendanceRate: number | null;
  minAccountAgeDays: number | null;
  maxDaysInAdvance: number | null;
  requireShiftTypeExperience: boolean;
  minVolunteerAge: number | null;
  maxVolunteerAge: number | null;
  requiredLabelIds: string[];

  criteriaLogic: CriteriaLogic;
}

/**
 * Everything about a volunteer that any criterion can ask about, resolved once
 * per evaluation. `hasShiftTypeExperience` is relative to the shift being
 * evaluated, so a snapshot is only meaningful alongside its ShiftContext.
 */
export interface VolunteerSnapshot {
  userId: string;
  name: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: VolunteerGrade;
  createdAt: Date;
  accountAgeDays: number;
  completedShifts: number;
  canceledShifts: number;
  attendanceRate: number;
  age: number | null;
  labelIds: string[];
  hasShiftTypeExperience: boolean;
}

/** The shift a decision is being made about. */
export interface ShiftContext {
  shiftId: string | null;
  shiftTypeId: string;
  shiftTypeName: string | null;
  location: string | null;
  start: Date;
  daysInAdvance: number;
}

/** How one criterion of one rule fared. */
export interface CriterionTrace {
  key: string;
  label: string;
  /** What the rule demands, in plain English. */
  requirement: string;
  /** What this volunteer/shift actually is. */
  actual: string;
  passed: boolean;
}

export type RuleTraceStatus =
  /** Every criterion the logic needed was satisfied. */
  | "MATCHED"
  /** Criteria were checked and came up short. */
  | "NOT_MATCHED"
  /** Wrong shift type or wrong location - never even considered. */
  | "OUT_OF_SCOPE"
  /** Rule has no criteria set, so it can never match anyone. */
  | "NO_CRITERIA";

/** How one rule fared, and why. */
export interface RuleTrace {
  ruleId: string;
  ruleName: string;
  kind: "APPROVE" | "BLOCK";
  priority: number;
  logic: CriteriaLogic;
  status: RuleTraceStatus;
  /** Set when status is OUT_OF_SCOPE. */
  scopeReason?: string;
  /** True for the single rule that produced the outcome. */
  decisive: boolean;
  criteria: CriterionTrace[];
}

export type DecisionOutcome = "APPROVED" | "HELD" | "BLOCKED" | "ERROR";

export interface Decision {
  outcome: DecisionOutcome;
  rule: { id: string; name: string; kind: "APPROVE" | "BLOCK" } | null;
  /** One line an admin can read without unfolding anything. */
  summary: string;
  trace: RuleTrace[];
  snapshot: VolunteerSnapshot;
  shift: ShiftContext;
}

/** Names needed to render ids as something a human recognises. */
export interface DescribeContext {
  labelNames: Map<string, { name: string; icon: string | null }>;
}
