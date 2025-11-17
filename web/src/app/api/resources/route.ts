import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// GET /api/resources - List all published resources (public)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);

  try {
    const whereClause: Prisma.ResourceWhereInput = {
      isPublished: true,
    };

    // Search by title and description
    if (query && query.trim()) {
      whereClause.OR = [
        { title: { contains: query.trim(), mode: "insensitive" } },
        { description: { contains: query.trim(), mode: "insensitive" } },
      ];
    }

    // Filter by category
    if (category) {
      whereClause.category = category as Prisma.EnumResourceCategoryFilter;
    }

    // Filter by type
    if (type) {
      whereClause.type = type as Prisma.EnumResourceTypeFilter;
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      whereClause.tags = {
        hasSome: tags,
      };
    }

    const resources = await prisma.resource.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        tags: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        url: true,
        createdAt: true,
        updatedAt: true,
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("Error fetching resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}
