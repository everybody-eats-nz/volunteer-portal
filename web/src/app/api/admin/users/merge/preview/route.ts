import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getMergePreview } from "@/lib/user-merge";

export async function GET(req: Request) {
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

  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("targetId");
    const sourceId = searchParams.get("sourceId");

    if (!targetId || !sourceId) {
      return NextResponse.json(
        { error: "Both targetId and sourceId are required" },
        { status: 400 }
      );
    }

    if (targetId === sourceId) {
      return NextResponse.json(
        { error: "Cannot merge a user with themselves" },
        { status: 400 }
      );
    }

    const preview = await getMergePreview(targetId, sourceId);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("Merge preview error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate merge preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
