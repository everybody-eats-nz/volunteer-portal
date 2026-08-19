import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-api";
import {
  ruleInclude,
  ruleInputSchema,
  serializeRules,
  validateRule,
} from "@/lib/auto-approval/admin-rules";

// GET /api/admin/auto-approval/rules
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const includeArchived =
    new URL(req.url).searchParams.get("includeArchived") === "true";

  const rules = await prisma.autoAcceptRule.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    include: ruleInclude,
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ rules: await serializeRules(rules) });
}

// POST /api/admin/auto-approval/rules
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = ruleInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const problem = validateRule(data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (data.shiftTypeId && !data.global) {
    const exists = await prisma.shiftType.count({
      where: { id: data.shiftTypeId },
    });
    if (!exists) {
      return NextResponse.json({ error: "Unknown shift type" }, { status: 400 });
    }
  }

  const rule = await prisma.autoAcceptRule.create({
    data: {
      ...data,
      description: data.description ?? null,
      shiftTypeId: data.global ? null : (data.shiftTypeId ?? null),
      location: data.location ?? null,
      minVolunteerGrade: data.minVolunteerGrade ?? null,
      minCompletedShifts: data.minCompletedShifts ?? null,
      minAttendanceRate: data.minAttendanceRate ?? null,
      minAccountAgeDays: data.minAccountAgeDays ?? null,
      maxDaysInAdvance: data.maxDaysInAdvance ?? null,
      minVolunteerAge: data.minVolunteerAge ?? null,
      maxVolunteerAge: data.maxVolunteerAge ?? null,
      createdBy: gate.actor.id,
    },
    include: ruleInclude,
  });

  const [serialized] = await serializeRules([rule]);
  return NextResponse.json({ rule: serialized }, { status: 201 });
}
