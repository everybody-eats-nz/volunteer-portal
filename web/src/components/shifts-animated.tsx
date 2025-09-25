"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface AnimatedProps {
  children: React.ReactNode;
  className?: string;
}

// Animated wrapper for shift cards grid
export function ShiftsGrid({ children, className }: AnimatedProps) {
  return (
    <motion.div 
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for individual shift card
export function AnimatedShiftCard({ children, className }: AnimatedProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={className}
    >
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.3 } }}
        className="h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Animated wrapper for the entire shifts container
export function ShiftsContainer({ children, className }: AnimatedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for collapsible sections
export function AnimatedCollapsible({ children, isOpen }: AnimatedProps & { isOpen?: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={isOpen ? "open" : "closed"}
      variants={{
        open: { opacity: 1, height: "auto" },
        closed: { opacity: 0, height: 0 }
      }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}

// Animated button for group booking and signup
export function AnimatedShiftButton({ children, className, onClick }: AnimatedProps & { onClick?: () => void }) {
  return (
    <motion.button
      className={className}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.button>
  );
}