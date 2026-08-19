import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { activeCriteria, describeRule } from "./criteria";
import { getDescribeContext } from "./snapshot";
import { toRuleConfig } from "./service";

export const ruleInputSchema = z.object({
  name: z.string().min(1, "Give the rule a name").max(100),
  description: z.string().max(500).nullish(),
  enabled: z.boolean().default(true),
  kind: z.enum(["APPROVE", "BLOCK"]).default("APPROVE"),
  priority: z.number().int().min(0).max(1000).default(0),
  global: z.boolean().default(false),
  shiftTypeId: z.string().nullish(),
  location: z.string().nullish(),
  minVolunteerGrade: z.enum(["GREEN", "YELLOW", "PINK"]).nullish(),
  minCompletedShifts: z.number().int().min(0).nullish(),
  minAttendanceRate: z.number().min(0).max(100).nullish(),
  minAccountAgeDays: z.number().int().min(0).nullish(),
  maxDaysInAdvance: z.number().int().min(0).nullish(),
  requireShiftTypeExperience: z.boolean().default(false),
  minVolunteerAge: z.number().int().min(0).max(120).nullish(),
  maxVolunteerAge: z.number().int().min(0).max(120).nullish(),
  requiredLabelIds: z.array(z.string()).default([]),
  criteriaLogic: z.enum(["AND", "OR"]).default("AND"),
});

export type RuleInput = z.infer<typeof ruleInputSchema>;

export const ruleInclude = {
  shiftType: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, email: true } },
  _count: { select: { approvals: true, decisions: true } },
} as const;

export type RuleWithRelations = Awaited<
  ReturnType<
    typeof prisma.autoAcceptRule.findMany<{ include: typeof ruleInclude }>
  >
>[number];

export type SerializedRule = RuleWithRelations & {
  requirements: string[];
  criteriaCount: number;
  decisionCount: number;
  approvalCount: number;
};

/**
 * Attaches the plain-English criteria summary and usage tallies, so the client
 * never has to reimplement rule semantics in order to render a rule.
 */
export async function serializeRules(
  rules: RuleWithRelations[]
): Promise<SerializedRule[]> {
  const ctx = await getDescribeContext();

  const matchCounts = rules.length
    ? await prisma.autoApprovalDecision.groupBy({
        by: ["ruleId"],
        where: { ruleId: { in: rules.map((r) => r.id) } },
        _count: { _all: true },
      })
    : [];
  const matchesByRule = new Map(matchCounts.map((m) => [m.ruleId, m._count._all]));

  return rules.map((rule) => {
    const config = toRuleConfig(rule);
    return {
      ...rule,
      requirements: describeRule(config, ctx),
      criteriaCount: activeCriteria(config).length,
      decisionCount: matchesByRule.get(rule.id) ?? 0,
      approvalCount: rule._count.approvals,
    };
  });
}

/**
 * Rejects the two ways a rule can be nonsense: no scope to apply to, and no
 * conditions (which would silently match nobody).
 */
export function validateRule(data: RuleInput): string | null {
  if (!data.global && !data.shiftTypeId) {
    return "Pick a shift type, or make the rule apply to every shift type.";
  }

  const config = toRuleConfig({
    ...data,
    id: "draft",
    description: null,
    shiftTypeId: data.shiftTypeId ?? null,
    location: data.location ?? null,
    minVolunteerGrade: data.minVolunteerGrade ?? null,
    minCompletedShifts: data.minCompletedShifts ?? null,
    minAttendanceRate: data.minAttendanceRate ?? null,
    minAccountAgeDays: data.minAccountAgeDays ?? null,
    maxDaysInAdvance: data.maxDaysInAdvance ?? null,
    minVolunteerAge: data.minVolunteerAge ?? null,
    maxVolunteerAge: data.maxVolunteerAge ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "",
    archivedAt: null,
  });

  if (activeCriteria(config).length === 0) {
    return "Set at least one condition, otherwise the rule can never match anyone.";
  }
  return null;
}

/** Fills a partial rule input out to a full RuleConfig for previewing drafts. */
export function draftToRuleConfig(d: Partial<RuleInput>) {
  return {
    id: "draft",
    name: d.name?.trim() || "Draft rule",
    kind: d.kind ?? "APPROVE",
    priority: d.priority ?? 0,
    global: d.global ?? false,
    shiftTypeId: d.shiftTypeId ?? null,
    location: d.location ?? null,
    minVolunteerGrade: d.minVolunteerGrade ?? null,
    minCompletedShifts: d.minCompletedShifts ?? null,
    minAttendanceRate: d.minAttendanceRate ?? null,
    minAccountAgeDays: d.minAccountAgeDays ?? null,
    maxDaysInAdvance: d.maxDaysInAdvance ?? null,
    requireShiftTypeExperience: d.requireShiftTypeExperience ?? false,
    minVolunteerAge: d.minVolunteerAge ?? null,
    maxVolunteerAge: d.maxVolunteerAge ?? null,
    requiredLabelIds: d.requiredLabelIds ?? [],
    criteriaLogic: d.criteriaLogic ?? "AND",
  } as const;
}
