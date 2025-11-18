import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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
    const query = searchParams.get("q")?.trim() || "";

    if (!query) {
      return NextResponse.json({ volunteers: [] });
    }

    // Search by name or email
    const volunteers = await prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
        role: "VOLUNTEER", // Only show volunteers, not admins
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhotoUrl: true,
      },
      take: 10, // Limit results
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ volunteers });
  } catch (error) {
    console.error("Volunteer search error:", error);
    return NextResponse.json(
      { error: "Failed to search volunteers" },
      { status: 500 }
    );
  }
}
