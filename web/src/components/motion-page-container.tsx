"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fadeVariants } from "@/lib/motion";

interface MotionPageContainerProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
  testid?: string;
  [key: string]: unknown; // Allow arbitrary props like data-testid
}

/**
 * Motion-enhanced page container with fade-in animation
 * Replaces the CSS animate-fade-in with motion.dev
 */
export function MotionPageContainer({
  children,
  className,
  animate = true,
  testid,
  ...props
}: MotionPageContainerProps) {
  const testProps = testid ? { "data-testid": testid } : {};

  // If animations are disabled, just return a regular div
  if (!animate) {
    return (
      <div className={cn("space-y-8", className)} {...props} {...testProps}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn("space-y-8", className)}
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      {...props}
      {...testProps}
    >
      {children}
    </motion.div>
  );
}
