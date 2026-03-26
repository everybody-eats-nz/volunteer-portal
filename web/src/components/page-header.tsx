"use client";

import { ReactNode } from "react";
import { motion, Variants } from "motion/react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string | ReactNode;
  children?: ReactNode;
  /** Actions that appear inline with the title on larger screens */
  actions?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

const headerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const descriptionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: 0.15,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const dividerVariants: Variants = {
  hidden: {
    scaleX: 0,
    opacity: 0,
  },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.5,
      delay: 0.25,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

const actionsVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      delay: 0.2,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function PageHeader({
  title,
  description,
  children,
  actions,
  className = "",
  "data-testid": dataTestId,
}: PageHeaderProps) {
  return (
    <motion.div
      className={cn("mb-4", className)}
      initial={"hidden"}
      animate={"visible"}
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <motion.h1
            className="text-3xl sm:text-5xl font-bold text-foreground tracking-tight"
            style={{ fontVariationSettings: '"WONK" 1, "SOFT" 50' }}
            data-testid={dataTestId}
            variants={headerVariants}
          >
            {title}
          </motion.h1>
          {description && (
            <motion.div
              className="text-base sm:text-lg text-muted-foreground mt-2 max-w-2xl leading-relaxed font-sans"
              data-testid={
                dataTestId
                  ? `${dataTestId.replace("-heading", "")}-description`
                  : undefined
              }
              variants={descriptionVariants}
            >
              {description}
            </motion.div>
          )}
        </div>
        {actions && (
          <motion.div className="flex-shrink-0" variants={actionsVariants}>
            {actions}
          </motion.div>
        )}
      </div>
      {children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
