import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Page-local branded header for the profile edit flow — eyebrow + Fraunces
 * display treatment matching the rest of the portal. Shared by the edit page
 * and its loading state so the two never drift. The accessible heading name
 * keeps "Edit Your Profile" and the description keeps the sentence the e2e
 * suite asserts on.
 */
export function ProfileEditPageHeader() {
  return (
    <header>
      <p className="eyebrow mb-4 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
        <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
        Kia ora · Keep your details fresh
      </p>
      <h1 className="display text-4xl leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50">
        Edit Your <em>Profile</em>
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75">
        Update your volunteer profile to help us provide you with the best
        possible experience. Your information is kept secure and confidential.
      </p>
      <div className="mt-6 flex justify-start">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-2 border-forest-500/20 px-4 text-forest-700 hover:bg-forest-500 hover:text-cream-50 hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
        >
          <Link href="/profile" data-testid="back-to-profile-link">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </Button>
      </div>
    </header>
  );
}
