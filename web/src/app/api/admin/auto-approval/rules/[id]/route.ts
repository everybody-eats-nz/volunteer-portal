import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import {
  ruleInclude,
  ruleInputSchema,
  serializeRules,
  validateRule,
  type RuleInput,
} from "@/lib/auto-approval/admin-rules";

type Params = { params: Promise<{ id: string }> };

// GET one rule
export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const rule = await prisma.autoAcceptRule.findUnique({
    where: { id },
    include: ruleInclude,
  });
  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const [serialized] = await serializeRules([rule]);
  return NextResponse.json({ rule: serialized });
}

/**
 * PATCH accepts either a full rule body or just `{ enabled }` / `{ archived }`
 * so the list can flip a switch without round-tripping the whole form.
 */
const partialSchema = ruleInputSchema.partial().extend({});

export async function PATCH(req: Request, { params }: Params) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const existing = await prisma.autoAcceptRule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const body = await req.json();
  const { archived, ...ruleFields } = body as Record<string, unknown>;

  const parsed = partialSchema.safeParse(ruleFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Validate the rule as it will be *after* the patch, not just the fields sent.
  const merged = { ...existing, ...parsed.data } as RuleInput;
  const problem = validateRule(merged);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const rule = await prisma.autoAcceptRule.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.global === true ? { shiftTypeId: null } : {}),
      ...(typeof archived === "boolean"
        ? { archivedAt: archived ? new Date() : null }
        : {}),
    },
    include: ruleInclude,
  });

  const [serialized] = await serializeRules([rule]);
  return NextResponse.json({ rule: serialized });
}

/**
 * A rule that has already decided something is archived, not deleted - the
 * decision log has to keep resolving to a real rule. Rules that never fired
 * are removed outright so the list doesn't fill up with mistakes.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const existing = await prisma.autoAcceptRule.findUnique({
    where: { id },
    include: { _count: { select: { approvals: true, decisions: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const history = existing._count.approvals + existing._count.decisions;

  if (history > 0) {
    await prisma.autoAcceptRule.update({
      where: { id },
      data: { archivedAt: new Date(), enabled: false },
    });
    return NextResponse.json({
      archived: true,
      message: `"${existing.name}" archived`,
      detail: `It decided ${history} signup${history === 1 ? "" : "s"}, so it's kept for the record instead of being deleted.`,
    });
  }

  await prisma.autoAcceptRule.delete({ where: { id } });
  return NextResponse.json({
    archived: false,
    message: `"${existing.name}" deleted`,
  });
}
