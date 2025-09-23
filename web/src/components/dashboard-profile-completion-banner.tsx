"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, User, FileText } from "lucide-react";

interface UserProfile {
  phone: string | null;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  volunteerAgreementAccepted: boolean;
  healthSafetyPolicyAccepted: boolean;
  requiresParentalConsent: boolean;
  parentalConsentReceived: boolean;
}

export function DashboardProfileCompletionBanner() {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    // Fetch user profile data
    fetch("/api/profile")
      .then((res) => res.json())
      .then((userData) => {
        setUser(userData);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [session]);

  if (loading || !session?.user?.id || !user) {
    return null;
  }

  // Check if essential profile information is missing
  const missingFields = [];
  const isMinor = user.requiresParentalConsent;
  const needsParentalConsent = isMinor && !user.parentalConsentReceived;

  if (!user.phone) missingFields.push("Mobile number");
  if (!user.dateOfBirth) missingFields.push("Date of birth");
  if (!user.emergencyContactName) missingFields.push("Emergency contact name");
  if (!user.emergencyContactPhone)
    missingFields.push("Emergency contact phone");
  if (!user.volunteerAgreementAccepted)
    missingFields.push("Volunteer agreement");
  if (!user.healthSafetyPolicyAccepted)
    missingFields.push("Health & safety policy");

  // If profile is complete and parental consent is handled, don't show banner
  if (missingFields.length === 0 && !needsParentalConsent) {
    return null;
  }

  // Special handling for parental consent
  if (needsParentalConsent) {
    return (
      <div
        className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-lg p-4 mb-6"
        data-testid="parental-consent-banner"
      >
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Parental consent required
            </h3>
            <div className="mt-1 text-sm text-orange-700 dark:text-orange-300">
              <p className="mb-2">
                Since you&apos;re under 18, we need parental consent before you
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
                    <strong>volunteers@everybodyeats.nz</strong>
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
                  className="text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                  onClick={() =>
                    window.open("/parental-consent-form.pdf", "_blank")
                  }
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Download Consent Form
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 mb-6"
      data-testid="profile-completion-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Complete your volunteer profile
          </h3>
          <div className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            <p className="mb-2">
              Your profile is missing some essential information needed to
              participate in shifts.
            </p>
            <p className="text-xs">Missing: {missingFields.join(", ")}</p>
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
