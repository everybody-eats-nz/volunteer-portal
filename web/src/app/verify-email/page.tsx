"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Mail, Loader2 } from "lucide-react";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

type VerificationState = "loading" | "success" | "error" | "expired" | "already_verified";

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: "", description: "" });
  
  const turnstileRef = useRef<TurnstileHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");
  const fromLogin = searchParams.get("from") === "login";

  const verifyEmail = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setState("success");
        setMessage(data.message);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login?verified=true");
        }, 3000);
      } else {
        if (data.error?.includes("already verified")) {
          setState("already_verified");
        } else if (data.error?.includes("expired")) {
          setState("expired");
        } else {
          setState("error");
        }
        setMessage(data.error);
      }
    } catch {
      setState("error");
      setMessage("Failed to verify email. Please try again.");
    }
  }, [token, router]);

  // Handle initial state setup
  const hasInitialized = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      // If coming from login page without a token, show resend interface
      if (!token && fromLogin) {
        setState("error");
        setMessage("Email verification required");
        if (emailParam) {
          setResendEmail(emailParam);
        }
      } else if (!token) {
        setState("error");
        setMessage("No verification token provided");
      }
    }
  });

  useEffect(() => {
    // Only verify if we have a token and haven't shown an error
    if (token && !(!token && fromLogin) && !(! token && !fromLogin)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      verifyEmail();
    }
  }, [token, fromLogin, verifyEmail]);

  const showDialog = (title: string, description: string) => {
    setDialogContent({ title, description });
    setDialogOpen(true);
  };

  const handleResendVerification = async () => {
    if (!resendEmail.trim()) {
      showDialog("Email Required", "Please enter your email address");
      return;
    }

    setIsResending(true);
    try {
      const turnstileToken = await turnstileRef.current?.getToken();
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
        },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        showDialog("Email Sent", data.message);
        setResendEmail("");
      } else {
        showDialog("Error", data.error || "Failed to send verification email");
      }
    } catch {
      showDialog("Error", "Failed to send verification email. Please try again.");
    }
    setIsResending(false);
  };

  const getIcon = () => {
    switch (state) {
      case "loading":
        return (
          <Loader2
            className="h-9 w-9 text-forest-500 animate-spin dark:text-forest-300"
            data-testid="loading-spinner"
          />
        );
      case "success":
      case "already_verified":
        return (
          <CheckCircle2
            className="h-9 w-9 text-forest-500 dark:text-forest-300"
            data-testid="success-icon"
          />
        );
      case "error":
        if (fromLogin && message === "Email verification required") {
          return (
            <Mail
              className="h-9 w-9 text-forest-500 dark:text-forest-300"
              data-testid="email-required-icon"
            />
          );
        }
        return (
          <XCircle
            className="h-9 w-9 text-red-500 dark:text-red-400"
            data-testid="error-icon"
          />
        );
      case "expired":
        return (
          <XCircle
            className="h-9 w-9 text-red-500 dark:text-red-400"
            data-testid="expired-icon"
          />
        );
      default:
        return (
          <Mail
            className="h-9 w-9 text-forest-500 dark:text-forest-300"
            data-testid="default-icon"
          />
        );
    }
  };

  // Error / expired states use a warm red wash; everything else uses forest.
  const isErrorTone =
    (state === "error" &&
      !(fromLogin && message === "Email verification required")) ||
    state === "expired";

  const getTitle = () => {
    switch (state) {
      case "loading":
        return "Verifying your email...";
      case "success":
        return "Email verified successfully!";
      case "already_verified":
        return "Email already verified";
      case "expired":
        return "Verification link expired";
      case "error":
        if (fromLogin && message === "Email verification required") {
          return "Email verification required";
        }
        return "Verification failed";
      default:
        return "Email verification";
    }
  };

  const getDescription = () => {
    switch (state) {
      case "loading":
        return "Please wait while we verify your email address.";
      case "success":
        return "Your email has been verified. You can now log in to your account. Redirecting to login page...";
      case "already_verified":
        return "Your email address has already been verified. You can log in to your account.";
      case "expired":
        return "Your verification link has expired. Please request a new verification email.";
      case "error":
        if (fromLogin && message === "Email verification required") {
          return "You need to verify your email address before you can log in. Please check your inbox for a verification email, or request a new one below.";
        }
        return message || "There was a problem verifying your email address.";
      default:
        return "";
    }
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} data-testid="verification-dialog">
        <DialogContent data-testid="dialog-content">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title">{dialogContent.title}</DialogTitle>
            <DialogDescription data-testid="dialog-description">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => setDialogOpen(false)} data-testid="dialog-ok-button">OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        className="flex min-h-[80vh] items-center justify-center px-4 py-10"
        data-testid="verify-email-page"
      >
        <Card
          className="grain relative w-full max-w-md overflow-hidden rounded-3xl border-forest-500/10 bg-card shadow-[0_24px_70px_-30px_rgb(14_42_28/0.45)] dark:border-cream-50/10"
          data-testid="verify-email-card"
        >
          <CardHeader className="text-center">
            <p className="eyebrow mx-auto mb-2 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              Kia ora
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            </p>
            <div
              className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl"
              data-testid="verification-icon"
              style={{
                background: isErrorTone
                  ? "rgb(239 68 68 / 0.1)"
                  : "rgb(29 83 55 / 0.1)",
              }}
            >
              {getIcon()}
            </div>
            <CardTitle
              className="display text-3xl tracking-tight text-forest-700 dark:text-cream-50"
              data-testid="verification-title"
            >
              {getTitle()}
            </CardTitle>
            <CardDescription
              className="text-base text-forest-700/70 dark:text-cream-50/70"
              data-testid="verification-description"
            >
              {getDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(state === "expired" || state === "error") && (
              <div className="space-y-4" data-testid="resend-section">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-forest-700/80 dark:text-cream-50/80"
                  >
                    Enter your email to resend verification
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-11 w-full rounded-xl border border-forest-500/20 bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-forest-500 focus-visible:ring-[3px] focus-visible:ring-forest-500/20 dark:border-cream-50/15 md:text-sm"
                    data-testid="resend-email-input"
                  />
                </div>
                <Turnstile ref={turnstileRef} />
                <Button
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="w-full h-11"
                  data-testid="resend-button"
                >
                  {isResending ? (
                    <>
                      <Loader2
                        className="w-4 h-4 mr-2 animate-spin"
                        data-testid="resend-loading-spinner"
                      />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend verification email
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="space-y-2.5" data-testid="navigation-buttons">
              {(state === "success" || state === "already_verified") && (
                <Button
                  asChild
                  className="w-full h-11"
                  data-testid="dashboard-button"
                >
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              )}

              <Button
                asChild
                variant="outline"
                className="w-full h-11"
                data-testid="login-button"
              >
                <Link href="/login">Go to Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}