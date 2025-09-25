"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

type VerificationState = "loading" | "success" | "error" | "expired" | "already_verified";

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState({ title: "", description: "" });
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");
  const fromLogin = searchParams.get("from") === "login";

  useEffect(() => {
    // If coming from login page without a token, show resend interface
    if (!token && fromLogin) {
      setState("error");
      setMessage("Email verification required");
      if (emailParam) {
        setResendEmail(emailParam);
      }
      return;
    }
    
    if (!token) {
      setState("error");
      setMessage("No verification token provided");
      return;
    }

    const verifyEmail = async () => {
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
    };

    verifyEmail();
  }, [token, router]);

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
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" data-testid="loading-spinner" />;
      case "success":
      case "already_verified":
        return <CheckCircle2 className="h-12 w-12 text-green-500" data-testid="success-icon" />;
      case "error":
        if (fromLogin && message === "Email verification required") {
          return <Mail className="h-12 w-12 text-blue-500" data-testid="email-required-icon" />;
        }
        return <XCircle className="h-12 w-12 text-red-500" data-testid="error-icon" />;
      case "expired":
        return <XCircle className="h-12 w-12 text-red-500" data-testid="expired-icon" />;
      default:
        return <Mail className="h-12 w-12 text-blue-500" data-testid="default-icon" />;
    }
  };

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

      <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="verify-email-page">
        <Card className="w-full max-w-md" data-testid="verify-email-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4" data-testid="verification-icon">
            {getIcon()}
          </div>
          <CardTitle className="text-2xl" data-testid="verification-title">{getTitle()}</CardTitle>
          <CardDescription className="text-base" data-testid="verification-description">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(state === "expired" || state === "error") && (
            <div className="space-y-4" data-testid="resend-section">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your email to resend verification
                </label>
                <input
                  id="email"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="resend-email-input"
                />
              </div>
              <Button 
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full"
                data-testid="resend-button"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" data-testid="resend-loading-spinner" />
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

          <div className="space-y-2" data-testid="navigation-buttons">
            <Button asChild variant="outline" className="w-full" data-testid="login-button">
              <Link href="/login">
                Go to Login
              </Link>
            </Button>
            
            {(state === "success" || state === "already_verified") && (
              <Button asChild className="w-full" data-testid="dashboard-button">
                <Link href="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
        </Card>
      </div>
    </>
  );
}