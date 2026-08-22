import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkProfileCompletion } from "@/lib/profile-completion";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, FileText } from "lucide-react";

export async function ProfileCompletionBannerServer() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const profileStatus = await checkProfileCompletion(session.user.id);

  // If profile is complete and no parental consent needed, don't show
  if (profileStatus.isComplete && !profileStatus.needsParentalConsent) {
    return null;
  }

  // Fetch consent form URL from site settings
  let consentFormUrl = "/parental-consent-form.pdf";
  if (profileStatus.needsParentalConsent) {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "PARENTAL_CONSENT_FORM_URL" },
      select: { value: true },
    });
    if (setting?.value) {
      consentFormUrl = setting.value;
    }
  }

  // Parental consent banner
  if (profileStatus.needsParentalConsent) {
    return (
      <div
        className="grain relative mb-6 overflow-hidden rounded-2xl border border-forest-500/15 bg-sun-100/70 p-4 dark:border-cream-50/12 dark:bg-sun-200/10"
        data-testid="parental-consent-banner"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sun-200 text-forest-700 ring-1 ring-forest-500/10 dark:bg-sun-200/20 dark:text-sun-200 dark:ring-cream-50/10">
            <FileText className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-forest-700 dark:text-cream-50">
              Parental consent required
            </h3>
            <div className="mt-1 text-sm text-forest-700/80 dark:text-cream-50/75">
              <p className="mb-2">
                Since you&apos;re under 16, we need parental consent before you
                can participate in shifts.
              </p>
              <div className="text-xs mb-3 space-y-1">
                <p className="font-medium">Next steps:</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Download the consent form below</li>
                  <li>
                    Print and have your parent/guardian complete and sign it
                  </li>
                  <li>
                    Email the signed form to:{" "}
                    <strong>volunteer@everybodyeats.nz</strong>
                  </li>
                  <li>
                    We&apos;ll approve your profile once we receive the form
                  </li>
                  <li>Please allow up to 10 days for approval</li>
                </ol>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-forest-500/30 text-forest-700 hover:bg-forest-500 hover:text-cream-50 dark:border-cream-50/25 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
                  asChild
                >
                  <a href={consentFormUrl} target="_blank" rel="noopener noreferrer" data-testid="download-consent-form">
                    <FileText className="h-4 w-4 mr-1" />
                    Download Consent Form
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Profile completion banner
  return (
    <div
      className="grain relative mb-6 overflow-hidden rounded-2xl border border-forest-500/15 bg-sun-100/70 p-4 dark:border-cream-50/12 dark:bg-sun-200/10"
      data-testid="profile-completion-banner"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sun-200 text-forest-700 ring-1 ring-forest-500/10 dark:bg-sun-200/20 dark:text-sun-200 dark:ring-cream-50/10">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-forest-700 dark:text-cream-50">
            Complete your volunteer profile
          </h3>
          <div className="mt-1 text-sm text-forest-700/80 dark:text-cream-50/75">
            <p className="mb-2">
              Your profile is missing some essential information needed to
              participate in shifts.
            </p>
            <p className="text-xs">
              Missing: {profileStatus.missingFields.join(", ")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="flex-shrink-0">
          <Link href="/profile/edit" className="flex items-center gap-1">
            <User className="h-4 w-4" />
            Complete Profile
          </Link>
        </Button>
      </div>
    </div>
  );
}
