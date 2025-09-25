"use client";

import { useEffect } from "react";
import { MotionGlobalConfig } from "motion/react";

/**
 * Configures motion.dev to disable animations in test environments
 * Should be included once in the app layout
 */
export function MotionConfig() {
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

  return null;
}
