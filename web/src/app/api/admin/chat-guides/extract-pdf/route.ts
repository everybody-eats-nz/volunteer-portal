import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { extractText } from "unpdf";

/**
 * POST /api/admin/chat-guides/extract-pdf
 *
 * Extracts text content from a resource's PDF file.
 * Body: { resourceId: string }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { resourceId } = (await request.json()) as { resourceId: string };

    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required" },
        { status: 400 },
      );
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      select: { fileUrl: true, type: true, title: true },
    });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (resource.type !== "PDF" || !resource.fileUrl) {
      return NextResponse.json(
        { error: "Resource is not a PDF or has no file URL" },
        { status: 400 },
      );
    }

    // Fetch the PDF and extract text using unpdf
    const response = await fetch(resource.fileUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PDF file" },
        { status: 502 },
      );
    }
    const buffer = await response.arrayBuffer();
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });

    // Clean up extracted text: collapse excessive whitespace
    const text = (result.text as string)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      text,
      pages: result.totalPages,
      title: resource.title,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from PDF" },
      { status: 500 },
    );
  }
}
