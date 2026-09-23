import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth-shell";
import {
  getResetTokenStatus,
  type ResetTokenStatus,
} from "@/lib/password-reset-tokens";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Copy for each way a reset link can be unusable. "invalid" covers both a
 * malformed token and one that has already been used or superseded by a
 * newer request (the token is cleared from the account in both cases, so
 * they are indistinguishable), and that is by far the most common case.
 */
const DEAD_LINK_COPY: Record<
  Exclude<ResetTokenStatus, "valid">,
  { heading: string; description: string; body: string }
> = {
  missing: {
    heading: "Invalid reset link",
    description: "This password reset link is invalid or has expired",
    body: "Please request a new password reset to continue.",
  },
  invalid: {
    heading: "This link has already been used",
    description:
      "Each password reset link only works once, and requesting a new one replaces any older links",
    body: "If you've already reset your password, you can sign in with it now. Otherwise, request a fresh link and use the newest email we send you.",
  },
  expired: {
    heading: "This link has expired",
    description: "Password reset links stop working after 24 hours",
    body: "No worries — request a new link and we'll email you a fresh one straight away.",
  },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const status = await getResetTokenStatus(token);

  if (status !== "valid" || !token) {
    const copy = DEAD_LINK_COPY[status === "valid" ? "missing" : status];
    return (
      <AuthShell
        testid="reset-password-page"
        cardTestid="invalid-token-card"
        brandEyebrow="Kia ora"
        brandHeading={
          <>
            Need a fresh <em>link</em>?
          </>
        }
        brandCopy="Password reset links expire to keep your account safe. Request a new one and we'll send it straight to your inbox."
        brandFooter="Ngā mihi — kia kaha."
        heading={copy.heading}
        description={copy.description}
      >
        <p
          className="text-forest-700/70 dark:text-cream-50/70 mb-6"
          data-testid={`reset-link-${status}`}
        >
          {copy.body}
        </p>
        <div className="space-y-3">
          <Button asChild className="w-full h-12 text-base" size="lg">
            <Link href="/forgot-password">Request new reset link</Link>
          </Button>
          {status === "invalid" && (
            <Button
              asChild
              variant="outline"
              className="w-full h-12 text-base"
              size="lg"
              data-testid="back-to-login-link"
            >
              <Link href="/login">Back to sign in</Link>
            </Button>
          )}
        </div>
      </AuthShell>
    );
  }

  return <ResetPasswordForm token={token} />;
}
