import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ profilePhotoUrl: null });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { profilePhotoUrl: true },
  });

  return NextResponse.json({
    profilePhotoUrl: user?.profilePhotoUrl ?? null,
  });
}
