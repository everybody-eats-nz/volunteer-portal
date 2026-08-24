"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { MotionFormError, MotionFormSuccess } from "@/components/motion-form";
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

const brandPoints = [
  "We'll email you a secure reset link",
  "The link expires for your safety",
  "Back with the whānau in no time",
];

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const urlEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(urlEmail);
  const [state, formAction, isPending] = useActionState(
    forgotPasswordAction,
    null
  );

  // Clear email on successful submission
  const prevSuccessRef = useRef<boolean>(false);
  useIsomorphicLayoutEffect(() => {
    if (state?.success && !prevSuccessRef.current) {
      prevSuccessRef.current = true;
      setEmail("");
    } else if (!state?.success && prevSuccessRef.current) {
      prevSuccessRef.current = false;
    }
  });

  return (
    <AuthShell
      testid="forgot-password-page"
      cardTestid="forgot-password-form-card"
      brandEyebrow="Kia ora"
      brandHeading={
        <>
          Let&apos;s get you back <em>in</em>
        </>
      }
      brandCopy="Forgotten your password? No worries — pop in your email and we'll send a link to set a new one."
      brandPoints={brandPoints}
      brandFooter="Ngā mihi — kia kaha."
      heading={
        <>
          <em>Reset</em> your password
        </>
      }
      description="Enter your email address and we'll send you instructions to reset your password"
    >
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
          <Label
            htmlFor="email"
            className="text-sm font-medium text-forest-700/80 dark:text-cream-50/80"
          >
            Email address
          </Label>
          <Input
            id="email"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15"
            disabled={isPending}
            data-testid="email-input"
            name="email"
          />
        </motion.div>

        <MotionFormSuccess
          show={!!state?.success}
          data-testid="success-message"
        >
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

        <MotionFormError
          show={state?.success === false}
          data-testid="error-message"
        >
          <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
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
            className="w-full h-12 text-base"
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
        className="mt-8 pt-8 border-t border-forest-500/10 dark:border-cream-50/10 text-center"
        data-testid="forgot-password-footer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <p className="text-sm text-forest-700/65 dark:text-cream-50/65 mb-3">
          Remember your password?
        </p>
        <Button asChild variant="outline" data-testid="back-to-login-link">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </motion.div>
    </AuthShell>
  );
}
