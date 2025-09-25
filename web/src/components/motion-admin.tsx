"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface MotionAdminProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Motion wrapper for admin table/list containers
 * Provides staggered animation for rows
 */
export function MotionAdminList({ children, className }: MotionAdminProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for individual admin table rows or list items
 */
export function MotionAdminRow({ children, className }: MotionAdminProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={staggerItem}
      whileHover={{ 
        backgroundColor: "rgba(0, 0, 0, 0.02)",
        transition: { duration: 0.2 }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for admin cards
 */
export function MotionAdminCard({ children, className }: MotionAdminProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ 
        y: -2,
        boxShadow: "0 10px 25px -3px rgb(0 0 0 / 0.1)",
        transition: { duration: 0.2 }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for admin page sections
 */
export function MotionAdminSection({ 
  children, 
  className,
  delay = 0 
}: MotionAdminProps & { delay?: number }) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.4, 0, 0.2, 1],
        delay 
      }}
    >
      {children}
    </motion.div>
  );
}