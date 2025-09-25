"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface MotionSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "white" | "muted";
  testid?: string;
}

/**
 * Motion-enhanced loading spinner
 * Replaces all animate-spin classes with motion.dev
 */
export function MotionSpinner({ 
  className, 
  size = "md",
  color = "primary",
  testid
}: MotionSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };

  const colorClasses = {
    primary: "text-primary",
    white: "text-white",
    muted: "text-muted-foreground"
  };

  const testProps = testid ? { "data-testid": testid } : {};

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={cn(sizeClasses[size], colorClasses[color], className)}
      {...testProps}
    >
      <Loader2 />
    </motion.div>
  );
}

/**
 * Simple spinning div for inline spinners
 */
export function SimpleSpinner({ className }: { className?: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={cn(
        "rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}