import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeUrl } from "@/lib/scrape-url";
import { refineContent } from "@/lib/refine-content";
import { invalidateStaticChatContext } from "@/lib/chat-context";

export const maxDuration = 300;

type RefreshStatus = "updated" | "refined" | "unchanged" | "failed";

/**
 * GET /api/cron/refresh-website-content
 *
 * Cron job that re-scrapes all LINK resources with includeInChat: true.
 * Runs daily at 4am UTC (~4-5pm NZT) to catch menu updates.
 *
 * Change detection compares against `lastScrapedContent` (the previous raw
 * scrape), NOT `chatContent` — admins may have cleaned chatContent up with
 * "Refine with AI", and comparing against it would clobber that work every
 * night. When a page really changed and the stored content had been refined,
 * the new scrape is re-refined before saving.
 *
 * Secured via CRON_SECRET (automatically set by Vercel).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const linkResources = await prisma.resource.findMany({
    where: {
      includeInChat: true,
      type: "LINK",
      url: { not: null },
    },
    select: {
      id: true,
      title: true,
      url: true,
      chatContent: true,
      lastScrapedContent: true,
    },
  });

  if (linkResources.length === 0) {
    return NextResponse.json({ message: "No LINK resources to refresh", refreshed: 0 });
  }

  const results: { id: string; title: string; status: RefreshStatus }[] = [];

  for (const resource of linkResources) {
    if (!resource.url) continue;

    const scraped = await scrapeUrl(resource.url);

    if (!scraped) {
      results.push({ id: resource.id, title: resource.title, status: "failed" });
      continue;
    }

    const newRaw = scraped.text.trim();
    const previousRaw = resource.lastScrapedContent?.trim();
    const current = resource.chatContent?.trim();

    // Page unchanged since the last scrape — leave chatContent alone
    // (it may be an AI-refined version of this exact scrape).
    if (previousRaw === newRaw) {
      results.push({ id: resource.id, title: resource.title, status: "unchanged" });
      continue;
    }

    // No scrape recorded yet, but the stored content already matches the
    // page — backfill lastScrapedContent without touching chatContent.
    if (!previousRaw && current === newRaw) {
      await prisma.resource.update({
        where: { id: resource.id },
        data: { lastScrapedContent: newRaw },
      });
      results.push({ id: resource.id, title: resource.title, status: "unchanged" });
      continue;
    }

    // The page changed. If the stored content wasn't the plain previous
    // scrape, an admin refined it — run the new scrape through the same
    // AI cleanup so their curation survives the update.
    const wasRefined = Boolean(current) && current !== (previousRaw ?? newRaw);
    let newContent = newRaw;
    let status: RefreshStatus = "updated";

    if (wasRefined) {
      try {
        const refined = await refineContent(newRaw, resource.title);
        if (refined) {
          newContent = refined;
          status = "refined";
        }
      } catch (error) {
        console.error(
          `[cron] Refine failed for "${resource.title}", storing raw scrape:`,
          error,
        );
      }
    }

    await prisma.resource.update({
      where: { id: resource.id },
      data: { chatContent: newContent, lastScrapedContent: newRaw },
    });

    results.push({ id: resource.id, title: resource.title, status });
  }

  const updated = results.filter((r) => r.status === "updated" || r.status === "refined").length;
  const failed = results.filter((r) => r.status === "failed").length;

  if (updated > 0) {
    invalidateStaticChatContext();
  }

  console.log(`[cron] Website content refresh: ${updated} updated, ${failed} failed, ${results.length - updated - failed} unchanged`);

  return NextResponse.json({
    message: `Refreshed ${updated} of ${linkResources.length} resources`,
    results,
  });
}
