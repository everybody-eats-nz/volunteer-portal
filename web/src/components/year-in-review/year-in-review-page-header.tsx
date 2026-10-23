import { PageHeader } from "@/components/page-header";

/** Shared by the page and its loading state so the two never drift. */
export function YearInReviewPageHeader({ year }: { year?: number }) {
  return (
    <PageHeader
      title={
        <>
          Your <em>{year ?? "year"}</em> in mahi
        </>
      }
      description="Your shifts, the meals you helped serve and the crew you served with, made into a video to share."
      className="pb-2"
      data-testid="year-in-review-heading"
    />
  );
}
