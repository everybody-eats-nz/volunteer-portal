import { PageHeader } from "@/components/page-header";

/**
 * Header for the profile view, shared by the page and its loading state so
 * the two never drift. The accessible heading name keeps "Your Profile" and
 * the description keeps the sentence the e2e suite asserts on.
 */
export function ProfilePageHeader() {
  return (
    <PageHeader
      title={
        <>
          Your <em>Profile</em>
        </>
      }
      description="Manage your volunteer account and track your impact"
      className="pb-4"
    />
  );
}
