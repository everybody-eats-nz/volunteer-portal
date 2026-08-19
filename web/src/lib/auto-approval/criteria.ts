import type { VolunteerGrade } from "@/generated/client";
import { VOLUNTEER_GRADE_INFO } from "@/lib/volunteer-grades";
import type {
  CriterionTrace,
  DescribeContext,
  RuleConfig,
  ShiftContext,
  VolunteerSnapshot,
} from "./types";

/**
 * Grades are a ladder, not a set - "Experienced or better" has to include
 * Shift Leader. Higher number wins.
 */
export const GRADE_PRIORITY: Record<VolunteerGrade, number> = {
  GREEN: 0,
  YELLOW: 1,
  PINK: 2,
};

export type CriterionGroup = "volunteer" | "track-record" | "shift" | "tag";

export const CRITERION_GROUPS: Record<
  CriterionGroup,
  { label: string; blurb: string }
> = {
  tag: {
    label: "Volunteer tags",
    blurb:
      "Name individual volunteers by the label they carry. This is how a specific person gets treated differently to everyone else.",
  },
  volunteer: {
    label: "Who they are",
    blurb: "Facts about the volunteer that don't depend on their shift history.",
  },
  "track-record": {
    label: "Track record",
    blurb: "What their history with us says about reliability.",
  },
  shift: {
    label: "The shift itself",
    blurb: "Conditions about the shift being signed up for, not the volunteer.",
  },
};

/**
 * One definition per criterion, used by *everything*: the evaluator, the
 * plain-English rule summary, the decision trace, the rule editor and the
 * coverage preview. Adding a criterion means adding one entry here.
 */
export interface CriterionDef {
  key: string;
  label: string;
  group: CriterionGroup;
  /** Is this criterion switched on for this rule? */
  isSet(rule: RuleConfig): boolean;
  /** What the rule demands: "at least 5 completed shifts". */
  requirement(rule: RuleConfig, ctx: DescribeContext): string;
  /** What's actually true: "12 completed shifts". */
  actual(
    snapshot: VolunteerSnapshot,
    shift: ShiftContext,
    ctx: DescribeContext
  ): string;
  passes(
    rule: RuleConfig,
    snapshot: VolunteerSnapshot,
    shift: ShiftContext
  ): boolean;
}

const gradeLabel = (grade: VolunteerGrade) =>
  `${VOLUNTEER_GRADE_INFO[grade].icon} ${VOLUNTEER_GRADE_INFO[grade].label}`;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export const CRITERIA: CriterionDef[] = [
  {
    key: "requiredLabelIds",
    label: "Volunteer tag",
    group: "tag",
    isSet: (rule) => rule.requiredLabelIds.length > 0,
    requirement: (rule, ctx) => {
      const names = rule.requiredLabelIds.map((id) => {
        const label = ctx.labelNames.get(id);
        if (!label) return "a deleted tag";
        return label.icon ? `${label.icon} ${label.name}` : label.name;
      });
      if (names.length === 1) return `tagged ${names[0]}`;
      return `tagged any of ${names.join(", ")}`;
    },
    actual: (snapshot, _shift, ctx) => {
      const names = snapshot.labelIds
        .map((id) => ctx.labelNames.get(id))
        .filter((l): l is { name: string; icon: string | null } => Boolean(l))
        .map((l) => (l.icon ? `${l.icon} ${l.name}` : l.name));
      return names.length ? `tagged ${names.join(", ")}` : "no tags";
    },
    passes: (rule, snapshot) =>
      rule.requiredLabelIds.some((id) => snapshot.labelIds.includes(id)),
  },
  {
    key: "minVolunteerGrade",
    label: "Volunteer grade",
    group: "volunteer",
    isSet: (rule) => rule.minVolunteerGrade !== null,
    requirement: (rule) =>
      `${gradeLabel(rule.minVolunteerGrade!)} or higher`,
    actual: (snapshot) => gradeLabel(snapshot.volunteerGrade),
    passes: (rule, snapshot) =>
      GRADE_PRIORITY[snapshot.volunteerGrade] >=
      GRADE_PRIORITY[rule.minVolunteerGrade!],
  },
  {
    key: "minVolunteerAge",
    label: "Age",
    group: "volunteer",
    isSet: (rule) => rule.minVolunteerAge !== null,
    requirement: (rule) => `at least ${rule.minVolunteerAge} years old`,
    actual: (snapshot) =>
      snapshot.age === null
        ? "no date of birth on file"
        : `${snapshot.age} years old`,
    // No date of birth means we cannot vouch for their age, so they fail.
    passes: (rule, snapshot) =>
      snapshot.age !== null && snapshot.age >= rule.minVolunteerAge!,
  },
  {
    key: "maxVolunteerAge",
    label: "Age",
    group: "volunteer",
    isSet: (rule) => rule.maxVolunteerAge !== null,
    requirement: (rule) => `under ${rule.maxVolunteerAge!} years old`,
    actual: (snapshot) =>
      snapshot.age === null
        ? "no date of birth on file"
        : `${snapshot.age} years old`,
    // Unknown age matches an upper bound: we can't confirm they're old enough,
    // so a "under 18" block should catch them rather than wave them through.
    passes: (rule, snapshot) =>
      snapshot.age === null || snapshot.age < rule.maxVolunteerAge!,
  },
  {
    key: "minAccountAgeDays",
    label: "Time with us",
    group: "volunteer",
    isSet: (rule) => rule.minAccountAgeDays !== null,
    requirement: (rule) =>
      `signed up at least ${plural(rule.minAccountAgeDays!, "day")} ago`,
    actual: (snapshot) =>
      `signed up ${plural(snapshot.accountAgeDays, "day")} ago`,
    passes: (rule, snapshot) =>
      snapshot.accountAgeDays >= rule.minAccountAgeDays!,
  },
  {
    key: "minCompletedShifts",
    label: "Completed shifts",
    group: "track-record",
    isSet: (rule) => rule.minCompletedShifts !== null,
    requirement: (rule) =>
      `at least ${plural(rule.minCompletedShifts!, "completed shift")}`,
    actual: (snapshot) =>
      plural(snapshot.completedShifts, "completed shift"),
    passes: (rule, snapshot) =>
      snapshot.completedShifts >= rule.minCompletedShifts!,
  },
  {
    key: "minAttendanceRate",
    label: "Attendance",
    group: "track-record",
    isSet: (rule) => rule.minAttendanceRate !== null,
    requirement: (rule) => `${rule.minAttendanceRate}% attendance or better`,
    actual: (snapshot) =>
      snapshot.completedShifts + snapshot.canceledShifts === 0
        ? "no history yet (counts as 100%)"
        : `${Math.round(snapshot.attendanceRate)}% attendance`,
    passes: (rule, snapshot) =>
      snapshot.attendanceRate >= rule.minAttendanceRate!,
  },
  {
    key: "requireShiftTypeExperience",
    label: "Done this shift before",
    group: "track-record",
    isSet: (rule) => rule.requireShiftTypeExperience,
    requirement: () => "has worked this shift type before",
    actual: (snapshot, shift) =>
      snapshot.hasShiftTypeExperience
        ? `has worked ${shift.shiftTypeName ?? "this shift type"} before`
        : `never worked ${shift.shiftTypeName ?? "this shift type"}`,
    passes: (_rule, snapshot) => snapshot.hasShiftTypeExperience,
  },
  {
    key: "maxDaysInAdvance",
    label: "Lead time",
    group: "shift",
    isSet: (rule) => rule.maxDaysInAdvance !== null,
    requirement: (rule) =>
      `shift starts within ${plural(rule.maxDaysInAdvance!, "day")}`,
    actual: (_snapshot, shift) =>
      shift.daysInAdvance <= 0
        ? "shift starts today"
        : `shift starts in ${plural(shift.daysInAdvance, "day")}`,
    passes: (rule, _snapshot, shift) =>
      shift.daysInAdvance <= rule.maxDaysInAdvance!,
  },
];

export const CRITERIA_BY_KEY = new Map(CRITERIA.map((c) => [c.key, c]));

/** The criteria this rule actually uses. */
export function activeCriteria(rule: RuleConfig): CriterionDef[] {
  return CRITERIA.filter((c) => c.isSet(rule));
}

/** Plain-English requirements for a rule, for cards and summaries. */
export function describeRule(
  rule: RuleConfig,
  ctx: DescribeContext
): string[] {
  return activeCriteria(rule).map((c) => c.requirement(rule, ctx));
}

export function traceCriteria(
  rule: RuleConfig,
  snapshot: VolunteerSnapshot,
  shift: ShiftContext,
  ctx: DescribeContext
): CriterionTrace[] {
  return activeCriteria(rule).map((c) => ({
    key: c.key,
    label: c.label,
    requirement: c.requirement(rule, ctx),
    actual: c.actual(snapshot, shift, ctx),
    passed: c.passes(rule, snapshot, shift),
  }));
}
