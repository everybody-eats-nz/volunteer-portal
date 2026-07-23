import { prisma } from "@/lib/prisma";
import { ResourcesSearch } from "@/components/resources-search";

export async function ResourcesSearchServer() {
  const allResources = await prisma.resource.findMany({
    // Match the Resource Hub grid: exclude chat-only guides so their tags
    // don't appear in the public filter list.
    where: { isPublished: true, includeInChat: false },
    select: { tags: true },
  });
  const uniqueTags = Array.from(
    new Set(allResources.flatMap((r) => r.tags))
  ).sort();

  return <ResourcesSearch availableTags={uniqueTags} />;
}
