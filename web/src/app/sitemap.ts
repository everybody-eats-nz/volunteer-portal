import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { VOLUNTEER_LOCATIONS } from "@/lib/volunteer-locations";

// Regenerate at most once per hour. Shifts can be created/edited frequently
// but search engines don't fetch sitemaps often enough to need fresher data.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  // Static public pages that should be indexed
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/shifts`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/volunteer`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Per-city volunteer landing pages — real indexable pages that target
  // "volunteering <city>" searches (replacing the old `?location=` query-param
  // URLs, which search engines largely ignore as distinct pages).
  const locationPages: MetadataRoute.Sitemap = VOLUNTEER_LOCATIONS.map(
    (loc) => ({
      url: `${baseUrl}/volunteer/${loc.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  // Individual shift detail pages — filter on `end` rather than `start` so
  // Postgres can use the existing @@index([end]) on Shift. Shifts currently
  // in progress remain shareable until they wrap up.
  const upcomingShifts = await prisma.shift.findMany({
    where: { end: { gte: new Date() } },
    select: { id: true, start: true },
    orderBy: { start: "asc" },
    take: 5000,
  });

  const shiftPages: MetadataRoute.Sitemap = upcomingShifts.map((shift) => ({
    url: `${baseUrl}/shifts/${shift.id}`,
    lastModified: shift.start,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...locationPages, ...shiftPages];
}
