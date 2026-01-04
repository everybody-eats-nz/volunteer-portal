import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/newsletter-lists - Get all active newsletter lists (public endpoint for authenticated users)
export async function GET() {
  try {
    const lists = await prisma.newsletterList.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        campaignMonitorId: true,
        description: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Error fetching newsletter lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
