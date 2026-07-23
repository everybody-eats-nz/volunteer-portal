import { prisma } from "@/lib/prisma";
import { ResourcesSearch } from "@/components/resources-search";

export async function ResourcesSearchServer() {
  const allResources = await prisma.resource.findMany({
    where: { isPublished: true },
    select: { tags: true },
  });
  const uniqueTags = Array.from(
    new Set(allResources.flatMap((r) => r.tags))
  ).sort();

  return <ResourcesSearch availableTags={uniqueTags} />;
}
