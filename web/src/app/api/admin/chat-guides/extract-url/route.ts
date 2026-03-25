import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { scrapeUrl } from "@/lib/scrape-url";

/**
 * POST /api/admin/chat-guides/extract-url
 *
 * Fetches a web page and extracts its text content.
 * Body: { url: string } or { resourceId: string }
 *
 * When resourceId is provided, looks up the resource's URL from the database.
 * When url is provided directly, uses that URL.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { url?: string; resourceId?: string };

    let targetUrl = body.url;

    // If resourceId provided, look up the URL from the database
    if (!targetUrl && body.resourceId) {
      const { prisma } = await import("@/lib/prisma");
      const resource = await prisma.resource.findUnique({
        where: { id: body.resourceId },
        select: { url: true, type: true, title: true },
      });

      if (!resource) {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }

      if (resource.type !== "LINK" || !resource.url) {
        return NextResponse.json(
          { error: "Resource is not a link or has no URL" },
          { status: 400 },
        );
      }

      targetUrl = resource.url;
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: "url or resourceId is required" },
        { status: 400 },
      );
    }

    // Validate the URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs are supported" }, { status: 400 });
    }

    // Only allow scraping from everybodyeats.nz
    if (!parsedUrl.hostname.endsWith("everybodyeats.nz")) {
      return NextResponse.json(
        { error: "Only URLs from everybodyeats.nz are allowed" },
        { status: 400 },
      );
    }

    const result = await scrapeUrl(targetUrl);

    if (!result) {
      return NextResponse.json(
        { error: "Could not extract text content from this page" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text: result.text,
      title: result.title,
      url: targetUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out — the page took too long to load" },
        { status: 504 },
      );
    }
    console.error("URL extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract content from URL" },
      { status: 500 },
    );
  }
}
