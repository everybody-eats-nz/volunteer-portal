import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST endpoint to create a test resource
 * Does NOT touch Supabase storage — for test use only
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      type,
      category,
      tags = [],
      url,
      fileUrl,
      fileName,
      fileSize,
      isPublished = true,
      uploadedBy,
    } = body;

    if (!title || !type || !category || !uploadedBy) {
      return NextResponse.json(
        { error: "title, type, category, and uploadedBy are required" },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        description,
        type,
        category,
        tags,
        url,
        fileUrl,
        fileName,
        fileSize,
        isPublished,
        uploadedBy,
      },
    });

    return NextResponse.json({ id: resource.id });
  } catch (error) {
    console.error("Error creating test resource:", error);
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to clean up test resources
 * Does NOT touch Supabase storage
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");

    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId required" },
        { status: 400 }
      );
    }

    await prisma.resource.delete({
      where: { id: resourceId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test resource:", error);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 }
    );
  }
}
