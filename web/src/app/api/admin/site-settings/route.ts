import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for URL settings
const urlSchema = z.string().url("Invalid URL format");

// GET - Fetch all site settings
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const settings = await prisma.siteSetting.findMany({
      orderBy: { category: "asc" },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching site settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch site settings" },
      { status: 500 }
    );
  }
}

// PATCH - Update a site setting
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key and value are required" },
        { status: 400 }
      );
    }

    // Validate URL format for document URLs
    if (key === "PARENTAL_CONSENT_FORM_URL") {
      try {
        // Allow relative URLs starting with / or absolute URLs
        if (!value.startsWith("/")) {
          urlSchema.parse(value);
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid URL format. Must be a valid URL or start with /" },
          { status: 400 }
        );
      }
    }

    const setting = await prisma.siteSetting.update({
      where: { key },
      data: {
        value,
        updatedBy: session.user.id,
      },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Error updating site setting:", error);
    return NextResponse.json(
      { error: "Failed to update site setting" },
      { status: 500 }
    );
  }
}
