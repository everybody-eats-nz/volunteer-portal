"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { buttonHoverVariants } from "@/lib/motion";
import { VariantProps } from "class-variance-authority";

interface MotionButtonProps 
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  enableMotion?: boolean;
  testid?: string;
}

/**
 * Motion-enhanced Button component
 * Adds hover and tap animations while maintaining all Button functionality
 */
export function MotionButton({ 
  enableMotion = true,
  className,
  children,
  testid,
  ...props 
}: MotionButtonProps) {
  const testProps = testid ? { "data-testid": testid } : {};

  if (!enableMotion) {
    return <Button className={className} {...props} {...testProps}>{children}</Button>;
  }

  return (
    <motion.div
      variants={buttonHoverVariants}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      className="inline-block"
      {...testProps}
    >
      <Button className={className} {...props}>
        {children}
      </Button>
    </motion.div>
  );
}

// For backwards compatibility and gradual migration
export { Button };