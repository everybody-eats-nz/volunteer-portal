"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface MotionStatCardProps extends React.ComponentProps<typeof Card> {
  children: React.ReactNode;
  testid?: string;
}

/**
 * Motion-enhanced Card specifically for dashboard stats
 * Combines Card component with stagger animation
 */
export function MotionStatCard({ children, className, testid, ...props }: MotionStatCardProps) {
  const testProps = testid ? { "data-testid": testid } : {};

  return (
    <motion.div
      variants={staggerItem}
      className={cn(className)}
      {...testProps}
    >
      <Card {...props}>
        {children}
      </Card>
    </motion.div>
  );
}