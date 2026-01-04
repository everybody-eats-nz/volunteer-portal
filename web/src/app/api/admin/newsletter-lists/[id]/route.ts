import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateNewsletterListSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  campaignMonitorId: z.string().min(1, "Campaign Monitor ID is required").optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

// GET /api/admin/newsletter-lists/[id] - Get a specific newsletter list
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;

  const list = await prisma.newsletterList.findUnique({
    where: { id },
  });

  if (!list) {
    return NextResponse.json({ error: "Newsletter list not found" }, { status: 404 });
  }

  return NextResponse.json(list);
}

// PATCH /api/admin/newsletter-lists/[id] - Update a newsletter list
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const validatedData = updateNewsletterListSchema.parse(body);

    // Check if newsletter list exists
    const existing = await prisma.newsletterList.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Newsletter list not found" }, { status: 404 });
    }

    // If updating campaign monitor ID, check it doesn't already exist
    if (validatedData.campaignMonitorId && validatedData.campaignMonitorId !== existing.campaignMonitorId) {
      const duplicate = await prisma.newsletterList.findUnique({
        where: { campaignMonitorId: validatedData.campaignMonitorId },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A newsletter list with this Campaign Monitor ID already exists" },
          { status: 400 }
        );
      }
    }

    const list = await prisma.newsletterList.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(list);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating newsletter list:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/newsletter-lists/[id] - Delete a newsletter list
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const list = await prisma.newsletterList.findUnique({
      where: { id },
    });

    if (!list) {
      return NextResponse.json({ error: "Newsletter list not found" }, { status: 404 });
    }

    await prisma.newsletterList.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting newsletter list:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
