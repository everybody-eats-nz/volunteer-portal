"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MotionFormError, MotionFormSuccess } from "@/components/motion-form";
import { MotionPageContainer } from "@/components/motion-page-container";
import { MotionCard } from "@/components/motion-card";
import { MotionSpinner } from "@/components/motion-spinner";
import { motion } from "motion/react";
import Link from "next/link";
import { resetPasswordAction } from "@/lib/actions/password-reset";
import { validatePassword } from "@/lib/utils/password-validation";
import { PasswordRequirements } from "@/components/password-requirements";

const formFieldVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Get token and error from URL
  useEffect(() => {
    const urlToken = searchParams.get("token");
    const urlError = searchParams.get("error");
    
    if (urlToken) {
      setToken(urlToken);
    }
    
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("Invalid reset token. Please request a new password reset.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    try {
      const result = await resetPasswordAction(token, null, formData);
      
      if (result.success) {
        setMessage(result.message);
        setPassword("");
        setConfirmPassword("");
        // Redirect to login after a delay
        setTimeout(() => {
          window.location.href = "/login?message=password-reset-success";
        }, 3000);
      } else {
        setError(result.error || result.message);
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <MotionPageContainer
        className="min-h-[80vh] flex items-center justify-center"
        testid="reset-password-page"
      >
        <div className="w-full max-w-md">
          <div className="text-center">
            <PageHeader
              title="Invalid reset link"
              description="This password reset link is invalid or has expired"
              className="mb-6"
            />
          </div>

          <MotionCard className="" testid="invalid-token-card">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground mb-6">
                Please request a new password reset to continue.
              </p>
              <Button asChild className="btn-primary">
                <Link href="/forgot-password">Request new reset link</Link>
              </Button>
            </CardContent>
          </MotionCard>
        </div>
      </MotionPageContainer>
    );
  }

  return (
    <MotionPageContainer
      className="min-h-[80vh] flex items-center justify-center"
      testid="reset-password-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center">
          <PageHeader
            title="Create new password"
            description="Enter your new password below"
            className="mb-6"
          />
        </div>

        <MotionCard className="" testid="reset-password-form-card">
          <CardContent className="p-8">
            <motion.form
              onSubmit={onSubmit}
              className="space-y-6"
              data-testid="reset-password-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="space-y-2"
                data-testid="password-field"
                variants={formFieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Label htmlFor="password" className="text-sm font-medium">
                  New password
                </Label>
                <Input
                  id="password"
                  placeholder="Enter new password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="focus-ring"
                  disabled={isLoading}
                  data-testid="password-input"
                />
<PasswordRequirements password={password} />
              </motion.div>

              <motion.div
                className="space-y-2"
                data-testid="confirm-password-field"
                variants={formFieldVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.1 }}
              >
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm new password
                </Label>
                <Input
                  id="confirmPassword"
                  placeholder="Confirm new password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="focus-ring"
                  disabled={isLoading}
                  data-testid="confirm-password-input"
                />
              </motion.div>

              <MotionFormSuccess show={!!message} data-testid="success-message">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 pt-0.5">
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="text-green-800 dark:text-green-200 font-medium text-sm leading-relaxed">
                    {message}
                    <div className="mt-2 text-xs">
                      Redirecting to login in a few seconds...
                    </div>
                  </div>
                </div>
              </MotionFormSuccess>

              <MotionFormError show={!!error} data-testid="error-message">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                </div>
              </MotionFormError>

              <motion.div variants={formFieldVariants} transition={{ delay: 0.2 }}>
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  size="lg"
                  disabled={isLoading || !!message}
                  data-testid="reset-password-submit-button"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <MotionSpinner size="sm" color="white" />
                      Resetting password...
                    </div>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </motion.div>
            </motion.form>

            <motion.div
              className="mt-6 pt-6 border-t border-border text-center"
              data-testid="reset-password-footer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <p className="text-sm text-muted-foreground mb-2">
                Remember your password?
              </p>
              <Button
                asChild
                variant="outline"
                data-testid="back-to-login-link"
              >
                <Link href="/login">Back to sign in</Link>
              </Button>
            </motion.div>
          </CardContent>
        </MotionCard>
      </div>
    </MotionPageContainer>
  );
}