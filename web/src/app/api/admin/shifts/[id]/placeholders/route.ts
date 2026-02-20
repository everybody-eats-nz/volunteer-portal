import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id: shiftId } = await params;

  try {
    const body = await req.json();
    const { placeholderCount } = body;

    if (typeof placeholderCount !== "number" || placeholderCount < 0) {
      return NextResponse.json(
        { error: "placeholderCount must be a non-negative integer" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.update({
      where: { id: shiftId },
      data: { placeholderCount: Math.floor(placeholderCount) },
      select: {
        id: true,
        placeholderCount: true,
      },
    });

    return NextResponse.json(shift);
  } catch (error) {
    console.error("Error updating placeholder count:", error);
    return NextResponse.json(
      { error: "Failed to update placeholder count" },
      { status: 500 }
    );
  }
}
