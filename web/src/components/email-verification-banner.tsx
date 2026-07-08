"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MotionSpinner } from "@/components/motion-spinner";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { CheckCircle2, MailWarning } from "lucide-react";

/**
 * Site-wide notice for signed-in users whose email is still unverified.
 *
 * Credentials logins are allowed without verification (the hard gate lives in
 * shift signup), so this banner is what tells volunteers they still have a
 * step to finish - and lets them resend the verification email in place.
 *
 * The session JWT snapshots emailVerified at login, so it can be stale in
 * both directions; the banner only renders after /api/profile confirms the
 * address is genuinely unverified.
 */
export function EmailVerificationBanner() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const turnstileRef = useRef<TurnstileHandle>(null);

  const [confirmedUnverified, setConfirmedUnverified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionUnverified =
    status === "authenticated" && session?.user?.emailVerified === false;

  // Re-check on navigation so the banner disappears soon after the user
  // clicks the verification link (e.g. in another tab) - the JWT itself
  // won't refresh until the next login.
  useEffect(() => {
    if (!sessionUnverified) {
      setConfirmedUnverified(false);
      return;
    }

    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!cancelled && profile) {
          setConfirmedUnverified(profile.emailVerified === false);
        }
      })
      .catch(() => {
        // Leave the banner as-is if the check fails
      });
    return () => {
      cancelled = true;
    };
  }, [sessionUnverified, pathname]);

  if (!sessionUnverified || !confirmedUnverified) {
    return null;
  }

  // Admin pages have their own sidebar layout, and /verify-email already
  // shows its own resend form.
  if (pathname.startsWith("/admin") || pathname.startsWith("/verify-email")) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    try {
      const turnstileToken = await turnstileRef.current?.getToken();
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        setResent(true);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send verification email");
      }
    } catch {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
      data-testid="email-verification-banner"
    >
      <div className="max-w-[88rem] mx-auto px-5 sm:px-8 lg:px-12 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <MailWarning
            className="h-5 w-5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Verify your email address.</span>{" "}
            <span className="text-amber-700 dark:text-amber-300">
              We sent a verification link to{" "}
              <span className="font-medium">{session?.user?.email}</span>.
              You&apos;ll need to verify before you can sign up for shifts.
            </span>
            {error && (
              <p
                className="mt-1 text-red-700 dark:text-red-400"
                role="alert"
                data-testid="email-verification-resend-error"
              >
                {error}
              </p>
            )}
          </div>
        </div>
        <Turnstile ref={turnstileRef} />
        <div aria-live="polite" className="flex-shrink-0 sm:self-center pl-8 sm:pl-0">
          {resent ? (
            <div
              className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400"
              data-testid="email-verification-resend-success"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Email sent. Check your inbox.
            </div>
          ) : (
            <Button
              onClick={handleResend}
              disabled={isResending}
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40 dark:hover:text-amber-100 bg-transparent"
              data-testid="email-verification-resend-button"
            >
              {isResending ? (
                <span className="flex items-center gap-2">
                  <MotionSpinner size="sm" />
                  Sending...
                </span>
              ) : (
                "Resend verification email"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
