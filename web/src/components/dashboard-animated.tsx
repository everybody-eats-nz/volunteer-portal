"use client";

import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useEffect, useRef, useState, ReactElement, Children } from "react";

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

// Masonry layout hook for dashboard cards
function useMasonry(itemCount: number, columnCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateLayoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const updateLayout = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const items = Array.from(container.children) as HTMLElement[];
      const gap = 24; // 6 * 4px (gap-6)

      // Reset heights for each column
      const columnHeights = new Array(columnCount).fill(0);

      items.forEach((item, index) => {
        // Determine which column to place this item in
        let columnIndex: number;
        if (index < columnCount) {
          // First row items go directly into their column
          columnIndex = index;
        } else {
          // Find the shortest column
          columnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        }

        item.style.position = "absolute";
        item.style.top = `${columnHeights[columnIndex]}px`;

        // Calculate left position: percentage + half-gaps before this column
        const leftPercent = (columnIndex * 100) / columnCount;
        const leftGap = columnIndex * (gap / 2);
        item.style.left = `calc(${leftPercent}% + ${leftGap}px)`;

        // Width: percentage minus half-gap on each side
        item.style.width = `calc(${100 / columnCount}% - ${gap / 2}px)`;

        columnHeights[columnIndex] += item.offsetHeight + gap;
      });

      // Set container height to the tallest column (remove trailing gap)
      const maxHeight = Math.max(...columnHeights) - gap;
      container.style.height = `${maxHeight}px`;
    };

    updateLayoutRef.current = updateLayout;

    // Update layout on mount and resize
    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    if (containerRef.current) {
      // Observe the container itself
      observer.observe(containerRef.current);

      // Also observe all children for height changes
      const items = Array.from(containerRef.current.children) as HTMLElement[];
      items.forEach((item) => observer.observe(item));
    }

    window.addEventListener("resize", updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [itemCount, columnCount]);

  return containerRef;
}

// Animated wrapper for the main content grid with masonry layout
export function ContentGrid({ children }: DashboardAnimatedProps) {
  const [columnCount, setColumnCount] = useState(1);
  const childArray = Children.toArray(children);
  const containerRef = useMasonry(childArray.length, columnCount);

  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth >= 1024) setColumnCount(2); // lg
      else setColumnCount(1);
    };

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="relative"
      style={{ minHeight: "200px" }}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {Children.map(children, (child) => (
        <motion.div variants={staggerItem} className="w-full">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Animated wrapper for the bottom grid with masonry layout
export function BottomGrid({ children }: DashboardAnimatedProps) {
  const [columnCount, setColumnCount] = useState(1);
  const childArray = Children.toArray(children);
  const containerRef = useMasonry(childArray.length, columnCount);

  useEffect(() => {
    const updateColumnCount = () => {
      if (window.innerWidth >= 1024) setColumnCount(2); // lg
      else setColumnCount(1);
    };

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => window.removeEventListener("resize", updateColumnCount);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="relative"
      style={{ minHeight: "200px" }}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {Children.map(children, (child) => (
        <motion.div variants={staggerItem} className="w-full">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
