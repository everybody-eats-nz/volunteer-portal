import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Fetch a specific site setting by key (public access)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { error: "Key parameter is required" },
        { status: 400 }
      );
    }

    const setting = await prisma.siteSetting.findUnique({
      where: { key },
      select: {
        key: true,
        value: true,
        description: true,
      },
    });

    if (!setting) {
      return NextResponse.json(
        { error: "Setting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Error fetching site setting:", error);
    return NextResponse.json(
      { error: "Failed to fetch site setting" },
      { status: 500 }
    );
  }
}
