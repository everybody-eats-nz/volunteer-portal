"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
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
import { forgotPasswordAction } from "@/lib/actions/password-reset";

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);

  // Pre-fill email if provided in URL
  useEffect(() => {
    const urlEmail = searchParams.get("email");
    if (urlEmail) {
      setEmail(urlEmail);
    }
  }, [searchParams]);

  // Clear email on successful submission
  useEffect(() => {
    if (state?.success) {
      setEmail("");
    }
  }, [state]);

  return (
    <MotionPageContainer
      className="min-h-[80vh] flex items-center justify-center"
      testid="forgot-password-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center">
          <PageHeader
            title="Reset your password"
            description="Enter your email address and we'll send you instructions to reset your password"
            className="mb-6"
          />
        </div>

        <MotionCard className="" testid="forgot-password-form-card">
          <CardContent className="p-8">
            <motion.form
              action={formAction}
              className="space-y-6"
              data-testid="forgot-password-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="space-y-2"
                data-testid="email-field"
                variants={formFieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <Input
                  id="email"
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="focus-ring"
                  disabled={isPending}
                  data-testid="email-input"
                  name="email"
                />
              </motion.div>

              <MotionFormSuccess show={!!state?.success} data-testid="success-message">
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
                    {state?.message}
                  </div>
                </div>
              </MotionFormSuccess>

              <MotionFormError show={state?.success === false} data-testid="error-message">
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
                    {state?.message}
                  </div>
                </div>
              </MotionFormError>

              <motion.div variants={formFieldVariants}>
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  size="lg"
                  disabled={isPending}
                  data-testid="forgot-password-submit-button"
                >
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <MotionSpinner size="sm" color="white" />
                      Sending instructions...
                    </div>
                  ) : (
                    "Send reset instructions"
                  )}
                </Button>
              </motion.div>
            </motion.form>

            <motion.div
              className="mt-6 pt-6 border-t border-border text-center"
              data-testid="forgot-password-footer"
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