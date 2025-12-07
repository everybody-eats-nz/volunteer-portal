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

  try {
    let whereClause = {};

    // If there's a search query, add search conditions
    if (query && query.trim()) {
      const searchQuery = query.trim();
      const searchWords = searchQuery.split(" ").filter(word => word.length > 0);

      const orConditions: any[] = [
        { email: { contains: searchQuery, mode: "insensitive" } },
        { firstName: { contains: searchQuery, mode: "insensitive" } },
        { lastName: { contains: searchQuery, mode: "insensitive" } },
        { name: { contains: searchQuery, mode: "insensitive" } },
      ];

      // For multi-word searches, add full name combination search
      // Example: "John Doe" should match firstName="John" AND lastName="Doe"
      if (searchWords.length >= 2) {
        orConditions.push({
          AND: [
            { firstName: { not: null } },
            { lastName: { not: null } },
            {
              firstName: {
                contains: searchWords[0],
                mode: "insensitive"
              }
            },
            {
              lastName: {
                contains: searchWords.slice(1).join(" "),
                mode: "insensitive"
              }
            },
          ],
        });
      }

      whereClause = { OR: orConditions };
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
