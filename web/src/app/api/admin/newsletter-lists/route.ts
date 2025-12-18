import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const newsletterListSchema = z.object({
  name: z.string().min(1, "Name is required"),
  campaignMonitorId: z.string().min(1, "Campaign Monitor ID is required"),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

// GET /api/admin/newsletter-lists - Get all newsletter lists
export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const lists = await prisma.newsletterList.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(lists);
}

// POST /api/admin/newsletter-lists - Create a new newsletter list
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validatedData = newsletterListSchema.parse(body);

    // Check if campaign monitor ID already exists
    const existing = await prisma.newsletterList.findUnique({
      where: { campaignMonitorId: validatedData.campaignMonitorId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A newsletter list with this Campaign Monitor ID already exists" },
        { status: 400 }
      );
    }

    const list = await prisma.newsletterList.create({
      data: validatedData,
    });

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating newsletter list:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
