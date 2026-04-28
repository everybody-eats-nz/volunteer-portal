import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const updateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; placeholderId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: shiftId, placeholderId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const existing = await prisma.shiftPlaceholder.findUnique({
    where: { id: placeholderId },
    select: { shiftId: true },
  });

  if (!existing || existing.shiftId !== shiftId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const placeholder = await prisma.shiftPlaceholder.update({
    where: { id: placeholderId },
    data: {
      name: parsed.data.name,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(placeholder);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; placeholderId: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { id: shiftId, placeholderId } = await params;

  const existing = await prisma.shiftPlaceholder.findUnique({
    where: { id: placeholderId },
    select: { shiftId: true },
  });

  if (!existing || existing.shiftId !== shiftId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.shiftPlaceholder.delete({ where: { id: placeholderId } });

  return NextResponse.json({ ok: true });
}
