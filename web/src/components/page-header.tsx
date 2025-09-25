"use client";

import { ReactNode } from "react";
import { motion, Variants } from "motion/react";

interface PageHeaderProps {
  title: string;
  description?: string;
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
      delay: 0.1,
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
      className={`${className}`}
      initial={"hidden"}
      animate={"visible"}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <motion.h1
            className="text-4xl sm:text-6xl italic font-bold bg-gradient-to-r from-primary to-primary-700 bg-clip-text text-transparent tracking-tighter"
            data-testid={dataTestId}
            variants={headerVariants}
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              className="text-lg text-muted-foreground mt-2"
              data-testid={
                dataTestId
                  ? `${dataTestId.replace("-heading", "")}-description`
                  : undefined
              }
              variants={descriptionVariants}
            >
              {description}
            </motion.p>
          )}
        </div>
        {actions && (
          <motion.div
            className="flex-shrink-0 sm:mt-1"
            variants={actionsVariants}
          >
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
