"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { useEntrance } from "@/hooks/use-entrance";
import { MotionPageContainer } from "@/components/motion-page-container";
import { Sparkle } from "@/components/sparkle";

export interface AuthShellProps {
  /** data-testid for the outer page container */
  testid: string;
  /** data-testid for the form panel (the right column) */
  cardTestid: string;
  /** Forest brand panel (left, desktop only) */
  brandHeading: ReactNode;
  brandCopy: string;
  brandPoints?: string[];
  brandFooter?: string;
  /** Form-side heading (the visible h1) and supporting description */
  heading: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

/**
 * Shared auth-page shell — a forest/cream editorial split panel matching the
 * marketing site (new.everybodyeats.nz). A forest-green brand panel (grain,
 * sun glow, kawakawa, te reo) sits beside the form on cream paper; on mobile
 * the brand panel collapses and the form leads with its own heading.
 *
 * Used by the login, forgot-password and reset-password pages so they read as
 * one cohesive system. See `home-landing.tsx` for the canonical style.
 */
export function AuthShell({
  testid,
  cardTestid,
  brandHeading,
  brandCopy,
  brandPoints,
  brandFooter,
  heading,
  description,
  children,
}: AuthShellProps) {
  const entrance = useEntrance();
  return (
    <MotionPageContainer
      className="flex items-center justify-center py-6 sm:py-10"
      testid={testid}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid overflow-hidden rounded-[2.5rem] border border-forest-500/10 bg-card shadow-[0_24px_70px_-30px_rgb(14_42_28/0.45)] dark:border-cream-50/10 lg:grid-cols-[1.05fr_1fr]">
          {/* ============ Brand panel (desktop) ============ */}
          <motion.aside
            className="grain relative hidden overflow-hidden bg-forest-700 p-10 text-cream-50 lg:flex lg:flex-col lg:justify-between xl:p-14"
            initial={entrance({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {/* Warm sun glow — radial gradient rather than a blur filter, which
                escapes the rounded-corner clip on composited layers in Chromium */}
            <div
              aria-hidden
              className="absolute -bottom-32 -right-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.18),transparent)]"
            />
            <Image
              src="/patterns/kawakawa.avif"
              alt=""
              width={416}
              height={416}
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-8 w-72 opacity-20"
            />

            <div className="relative">
              <h2 className="display text-4xl leading-[1.02] tracking-tight xl:text-5xl">
                {brandHeading}
              </h2>
              <p className="mt-6 max-w-sm text-lg leading-relaxed text-cream-50/80">
                {brandCopy}
              </p>

              {brandPoints && brandPoints.length > 0 && (
                <ul className="mt-10 space-y-3.5">
                  {brandPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <Sparkle className="mt-1 h-4 w-4 shrink-0 text-sun-200" />
                      <span className="text-cream-50/85">{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {brandFooter && (
              <p className="relative mt-12 text-sm text-cream-50/60">
                {brandFooter}
              </p>
            )}
          </motion.aside>

          {/* ============ Form panel ============ */}
          <div
            className="relative px-6 py-10 sm:px-10 sm:py-12 lg:px-12"
            data-testid={cardTestid}
          >
            <div className="mb-8">
              <h1 className="display text-4xl tracking-tight text-forest-700 sm:text-5xl dark:text-cream-50">
                {heading}
              </h1>
              {description && (
                <p className="mt-3 text-base text-forest-700/70 dark:text-cream-50/70">
                  {description}
                </p>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </MotionPageContainer>
  );
}
