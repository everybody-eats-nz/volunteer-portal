import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const placeholderSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id: shiftId } = await params;

  const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = placeholderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const placeholder = await prisma.shiftPlaceholder.create({
    data: {
      shiftId,
      name: parsed.data.name,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(placeholder, { status: 201 });
}
