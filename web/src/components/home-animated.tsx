"use client";

import { motion } from "motion/react";
import { useEntrance } from "@/hooks/use-entrance";
import {
  fadeVariants,
  slideUpVariants,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";

interface AnimatedProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown; // Allow arbitrary props like data-testid
}

// Generic stagger item — fades up as part of a parent stagger container
export function StaggerItem({ children, className, ...props }: AnimatedProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  );
}

// Reusable stagger container (parent for StaggerItem children)
export function StaggerGroup({ children, className, ...props }: AnimatedProps) {
  const entrance = useEntrance();
  return (
    <motion.div
      variants={staggerContainer}
      initial={entrance("hidden")}
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for the home page
export function HomePageWrapper({ children, className, ...props }: AnimatedProps) {
  const entrance = useEntrance();
  return (
    <motion.div
      variants={fadeVariants}
      initial={entrance("hidden")}
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for hero section content
export function HeroContent({ children, className, ...props }: AnimatedProps) {
  const entrance = useEntrance();
  return (
    <motion.div
      variants={slideUpVariants}
      initial={entrance("hidden")}
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for feature cards
export function FeatureCard({ children, className, delay = 0, ...props }: AnimatedProps & { delay?: number }) {
  const entrance = useEntrance();
  return (
    <motion.div
      initial={entrance({ opacity: 0, y: 20 })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.4, 0, 0.2, 1],
        delay 
      }}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated wrapper for feature grid
export function FeatureGrid({ children, className, ...props }: AnimatedProps) {
  const entrance = useEntrance();
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial={entrance("hidden")}
      animate="visible"
      {...props}
    >
      {children}
    </motion.div>
  );
}