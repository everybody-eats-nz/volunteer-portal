import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

/**
 * Header for the profile edit flow, shared by the edit page and its loading
 * state so the two never drift. The accessible heading name keeps "Edit Your
 * Profile" and the description keeps the sentence the e2e suite asserts on.
 */
export function ProfileEditPageHeader() {
  return (
    <div>
      <PageHeader
        title={
          <>
            Edit Your <em>Profile</em>
          </>
        }
        description="Update your volunteer profile to help us provide you with the best possible experience. Your information is kept secure and confidential."
        sparkle={false}
        className="pb-0"
      />
      <div className="mt-6 flex justify-start">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-2 border-forest-500/20 px-4 text-forest-700 hover:bg-forest-500 hover:text-cream-50 dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
        >
          <Link href="/profile" data-testid="back-to-profile-link">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}
