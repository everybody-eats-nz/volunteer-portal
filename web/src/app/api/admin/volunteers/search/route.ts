import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The role is already on the session — loading the full user row on every
  // keystroke just to re-read it doubles the queries on a hot search path.
  if (session.user.role !== "ADMIN") {
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
        archivedAt: null,
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
        // Include both volunteers and admins so admins can also be assigned to shifts
      },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhotoUrl: true,
        role: true,
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
