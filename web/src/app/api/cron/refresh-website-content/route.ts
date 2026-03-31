import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scrape-url";

/**
 * GET /api/cron/refresh-website-content
 *
 * Cron job that re-scrapes all LINK resources with includeInChat: true.
 * Runs daily at 4am UTC (~4-5pm NZT) to catch menu updates.
 *
 * Secured via CRON_SECRET (automatically set by Vercel).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linkResources = await prisma.resource.findMany({
    where: {
      includeInChat: true,
      type: "LINK",
      url: { not: null },
    },
    select: { id: true, title: true, url: true },
  });

  if (linkResources.length === 0) {
    return NextResponse.json({ message: "No LINK resources to refresh", refreshed: 0 });
  }

  const results: { id: string; title: string; status: "updated" | "unchanged" | "failed" }[] = [];

  for (const resource of linkResources) {
    if (!resource.url) continue;

    const scraped = await scrapeUrl(resource.url);

    if (!scraped) {
      results.push({ id: resource.id, title: resource.title, status: "failed" });
      continue;
    }

    // Only update if content actually changed
    const existing = await prisma.resource.findUnique({
      where: { id: resource.id },
      select: { chatContent: true },
    });

    if (existing?.chatContent?.trim() === scraped.text.trim()) {
      results.push({ id: resource.id, title: resource.title, status: "unchanged" });
      continue;
    }

    await prisma.resource.update({
      where: { id: resource.id },
      data: { chatContent: scraped.text },
    });

    results.push({ id: resource.id, title: resource.title, status: "updated" });
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`[cron] Website content refresh: ${updated} updated, ${failed} failed, ${results.length - updated - failed} unchanged`);

  return NextResponse.json({
    message: `Refreshed ${updated} of ${linkResources.length} resources`,
    results,
  });
}
