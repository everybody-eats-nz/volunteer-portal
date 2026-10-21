"use client";

import { useEffect } from "react";
import { MotionConfig, MotionGlobalConfig } from "motion/react";

/**
 * App-wide motion.dev settings. Included once, in Providers.
 *
 * - `reducedMotion="user"`: when the OS asks for reduced motion, transform
 *   and layout animations are skipped and only opacity / colour still tween.
 * - Animations are switched off entirely in test environments.
 */
export function MotionSettings({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Disable animations in test environment
    const isPlaywright = !!(window as unknown as { playwright?: unknown })
      .playwright;
    const isTestEnv = process.env.NODE_ENV === "test";
    const isPlaywrightUserAgent =
      typeof navigator !== "undefined" &&
      navigator.userAgent?.includes("Playwright");
    const hasDisableFlag =
      process.env.NEXT_PUBLIC_DISABLE_ANIMATIONS === "true";

    if (isPlaywright || isTestEnv || isPlaywrightUserAgent || hasDisableFlag) {
      MotionGlobalConfig.skipAnimations = true;
      console.log("Animations disabled for testing environment");
    }
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
