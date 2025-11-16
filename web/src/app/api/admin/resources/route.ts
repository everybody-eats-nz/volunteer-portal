import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const createResourceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["PDF", "IMAGE", "DOCUMENT", "LINK", "VIDEO"]),
  category: z.enum([
    "TRAINING",
    "POLICIES",
    "FORMS",
    "GUIDES",
    "RECIPES",
    "SAFETY",
    "GENERAL",
  ]),
  tags: z.array(z.string()).default([]),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  url: z.string().optional(),
  isPublished: z.boolean().default(true),
});

// GET /api/admin/resources - List all resources (including unpublished)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const isPublished = searchParams.get("published");

  try {
    const whereClause: Prisma.ResourceWhereInput = {};

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

    // Filter by published status
    if (isPublished !== null && isPublished !== undefined) {
      whereClause.isPublished = isPublished === "true";
    }

    const resources = await prisma.resource.findMany({
      where: whereClause,
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
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

// POST /api/admin/resources - Create new resource
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const userId = session?.user?.id;

  if (role !== "ADMIN" || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validatedData = createResourceSchema.parse(body);

    // Validate that either fileUrl or url is provided based on type
    if (validatedData.type === "LINK" || validatedData.type === "VIDEO") {
      if (!validatedData.url) {
        return NextResponse.json(
          { error: "URL is required for LINK and VIDEO types" },
          { status: 400 }
        );
      }
    } else {
      if (!validatedData.fileUrl) {
        return NextResponse.json(
          { error: "File upload is required for this resource type" },
          { status: 400 }
        );
      }
    }

    const resource = await prisma.resource.create({
      data: {
        ...validatedData,
        uploadedBy: userId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error("Error creating resource:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 }
    );
  }
}
