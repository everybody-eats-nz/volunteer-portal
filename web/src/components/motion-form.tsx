"use client";

import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface MotionFormProps {
  children: React.ReactNode;
  className?: string;
  testid?: string;
}

/**
 * Motion wrapper for form fields with focus animations
 */
export function MotionFormField({ 
  children, 
  className,
  testid,
  delay = 0 
}: MotionFormProps & { delay?: number }) {
  const testProps = testid ? { "data-testid": testid } : {};

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1],
        delay 
      }}
      {...testProps}
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for form sections
 */
export function MotionFormSection({ 
  children, 
  className,
  title 
}: MotionFormProps & { title?: string }) {
  return (
    <motion.div
      className={cn("space-y-4", className)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {title && (
        <motion.h3 
          className="text-lg font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {title}
        </motion.h3>
      )}
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for form error messages
 */
export function MotionFormError({ 
  children,
  show,
  ...props
}: { children: React.ReactNode; show: boolean; [key: string]: unknown }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="text-sm text-destructive"
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Motion wrapper for form submit button with loading state
 */
export function MotionFormSubmit({ 
  children, 
  isLoading,
  className 
}: MotionFormProps & { isLoading?: boolean }) {
  return (
    <motion.div
      className={cn(className)}
      whileHover={{ scale: isLoading ? 1 : 1.02 }}
      whileTap={{ scale: isLoading ? 1 : 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
            />
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Motion wrapper for form success messages
 */
export function MotionFormSuccess({ 
  children,
  show,
  ...props 
}: { children: React.ReactNode; show: boolean; [key: string]: unknown }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ 
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }}
          className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}