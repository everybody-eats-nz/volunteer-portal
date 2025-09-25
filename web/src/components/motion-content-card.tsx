"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MotionContentCardProps extends React.ComponentProps<typeof Card> {
  children: React.ReactNode;
  delay?: number;
}

/**
 * Motion-enhanced Card for dashboard content sections
 * Includes slide-up animation with configurable delay
 */
export function MotionContentCard({
  children,
  className,
  delay = 0,
  ...props
}: MotionContentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay,
      }}
      className="h-full contents"
    >
      <Card className={cn("h-full", className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}
