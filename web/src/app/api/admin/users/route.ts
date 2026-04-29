import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// GET /api/admin/users - List all users (for admin use) with optional search
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = searchParams.get("limit");
  const idsParam = searchParams.get("ids");

  try {
    let whereClause: Record<string, unknown> = { archivedAt: null };

    // If a comma-separated list of IDs is provided, hydrate exactly those
    // users (used by the announcements form to render selected-volunteer
    // badges from query-string prefill).
    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 200);
      whereClause = { id: { in: ids } };
    } else if (query && query.trim()) {
      // If there's a search query, add search conditions
      const searchQuery = query.trim();

      whereClause = {
        archivedAt: null,
        OR: [
          // Email matching
          { email: { contains: searchQuery, mode: "insensitive" } },

          // Name partial matching
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
        ],
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        profileCompleted: true,
        profilePhotoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "asc" }, // Admins first
        { email: "asc" },
      ],
      take: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
