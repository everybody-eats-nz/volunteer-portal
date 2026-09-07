import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVanAdmin } from "@/lib/van/admin-guard";

const createSchema = z.object({
  label: z.string().trim().min(2).max(60),
  requiresNote: z.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(2).max(60).optional(),
  requiresNote: z.boolean().optional(),
  isActive: z.boolean().optional(),
  /** Move one place up (-1) or down (+1) in the order drivers see. */
  move: z.union([z.literal(-1), z.literal(1)]).optional(),
});

export async function POST(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Give it a name." }, { status: 400 });
  }

  const last = await prisma.tripPurpose.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const purpose = await prisma.tripPurpose.create({
    data: {
      label: parsed.data.label,
      requiresNote: parsed.data.requiresNote,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ purpose }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  }
  const { id, move, ...fields } = parsed.data;

  // Retiring a purpose hides it from drivers without touching the trips already
  // logged against it — but leaving nothing to pick would strand the flow.
  if (fields.isActive === false) {
    const activeCount = await prisma.tripPurpose.count({ where: { isActive: true } });
    if (activeCount <= 1) {
      return NextResponse.json(
        { error: "Drivers need at least one purpose to pick." },
        { status: 400 }
      );
    }
  }

  if (move) {
    const ordered = await prisma.tripPurpose.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    const index = ordered.findIndex((p) => p.id === id);
    const target = index + move;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return NextResponse.json({ error: "Cannot move that." }, { status: 400 });
    }
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    // Rewrite the whole order in one transaction: a half-applied reorder would
    // change what drivers see for the worse.
    await prisma.$transaction(
      ordered.map((purpose, i) =>
        prisma.tripPurpose.update({
          where: { id: purpose.id },
          data: { sortOrder: i + 1 },
        })
      )
    );
  }

  if (Object.keys(fields).length > 0) {
    await prisma.tripPurpose.update({ where: { id }, data: fields });
  }

  const purposes = await prisma.tripPurpose.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ purposes });
}
