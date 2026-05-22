import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

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
  ];

  // Get unique locations from shift types for location-specific pages
  // These help with local SEO (e.g., "volunteer Wellington")
  const locations = await prisma.shift.findMany({
    distinct: ["location"],
    where: {
      location: { not: null },
      start: { gte: new Date() }, // Only include locations with upcoming shifts
    },
    select: {
      location: true,
    },
  });

  // Dynamic location pages
  const locationPages: MetadataRoute.Sitemap = locations
    .filter((item) => item.location)
    .map((item) => ({
      url: `${baseUrl}/shifts?location=${encodeURIComponent(item.location!)}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7, // Lower priority than main shifts page
    }));

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
