import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  // Static public pages
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
  ];

  // Get unique locations from shift types
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
      priority: 0.8,
    }));

  return [...staticPages, ...locationPages];
}
