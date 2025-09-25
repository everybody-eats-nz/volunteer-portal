"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface DashboardAnimatedProps {
  children: React.ReactNode;
}

// Animated wrapper for the stats grid
export function StatsGrid({ children }: DashboardAnimatedProps) {
  return (
    <motion.div
      className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for individual stat cards
// This component should be applied to each grid item to maintain proper layout
export function StatCard({ children }: DashboardAnimatedProps) {
  return (
    <motion.div
      variants={staggerItem}
      className="contents" // Use Tailwind's contents utility
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for the main content grid
export function ContentGrid({ children }: DashboardAnimatedProps) {
  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for the bottom grid
export function BottomGrid({ children }: DashboardAnimatedProps) {
  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
