/** Human label for a marketing CMS journal category slug. */
export function journalCategoryLabel(category?: string): string {
  if (!category) return "From the journal";
  const labels: Record<string, string> = {
    story: "Story",
    news: "News",
    recipe: "Recipe",
    "behind-the-scenes": "Behind the scenes",
    impact: "Impact",
  };
  return labels[category] ?? category;
}
