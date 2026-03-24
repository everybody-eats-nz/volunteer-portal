import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

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

    // Fetch the PDF file
    const pdfResponse = await fetch(resource.fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download PDF: ${pdfResponse.status}` },
        { status: 502 },
      );
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    const parsed = await pdfParse(pdfBuffer);

    // Clean up extracted text: collapse excessive whitespace
    const text = parsed.text
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      text,
      pages: parsed.numpages,
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
