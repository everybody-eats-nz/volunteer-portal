import { PageHeader } from "@/components/page-header";

/**
 * Header for the achievements page, shared by the page and its loading state
 * so the two never drift. The accessible heading name keeps the word
 * "Achievements" that the e2e suite waits on.
 */
export function AchievementsPageHeader() {
  return (
    <PageHeader
      title={
        <>
          Your <em>Achievements</em>
        </>
      }
      description="Track your volunteer journey and see how you compare with others"
      className="pb-2"
      data-testid="achievements-page-heading"
    />
  );
}
