"use client";

import { motion, AnimatePresence } from "motion/react";
import { staggerContainer, staggerItem, slideUpVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface MotionFriendsProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Motion wrapper for friends list container
 */
export function MotionFriendsList({ children, className }: MotionFriendsProps) {
  return (
    <motion.div
      className={cn("space-y-4", className)}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for individual friend cards. Entrance is staggered; the
 * hover lift lives on the card itself (CSS translate, marketing-style).
 */
export function MotionFriendCard({ children, className }: MotionFriendsProps) {
  return (
    <motion.div className={cn("h-full", className)} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for friend request notifications — fresh requests get a
 * soft sun-yellow wash, the brand's "look here" accent.
 */
export function MotionFriendRequest({
  children,
  className,
  isNew = false,
}: MotionFriendsProps & { isNew?: boolean }) {
  return (
    <motion.div
      className={cn("rounded-3xl", className)}
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        x: 4,
        transition: { duration: 0.2 },
      }}
      style={
        isNew
          ? {
              background:
                "linear-gradient(90deg, rgb(248 251 105 / 0.10) 0%, transparent 100%)",
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}

/**
 * Motion wrapper for friend stats cards
 */
export function MotionFriendStats({
  children,
  className,
  delay = 0,
}: MotionFriendsProps & { delay?: number }) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated presence wrapper for friend removal
 */
export function MotionFriendPresence({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 1, height: "auto" }}
        exit={{
          opacity: 0,
          height: 0,
          transition: { duration: 0.3 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
