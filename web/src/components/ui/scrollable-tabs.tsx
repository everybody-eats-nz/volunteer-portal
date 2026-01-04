"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TabsList } from "@/components/ui/tabs";

/**
 * ScrollableTabsList - A mobile-friendly tabs list that scrolls horizontally
 *
 * This component wraps the standard TabsList and makes it scrollable on mobile
 * devices when there are too many tabs to fit on screen. It's especially useful
 * for category filters, navigation tabs, or any scenario with multiple tab options.
 *
 * Features:
 * - Horizontal scrolling on mobile
 * - Smooth scroll behavior
 * - Fade indicators on the edges (optional)
 * - Maintains accessibility
 *
 * Usage:
 * ```tsx
 * <Tabs>
 *   <ScrollableTabsList>
 *     <TabsTrigger value="tab1">Tab 1</TabsTrigger>
 *     <TabsTrigger value="tab2">Tab 2</TabsTrigger>
 *     <TabsTrigger value="tab3">Tab 3</TabsTrigger>
 *   </ScrollableTabsList>
 *   <TabsContent value="tab1">Content 1</TabsContent>
 * </Tabs>
 * ```
 */
export function ScrollableTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <div className="relative w-full">
      {/* Gradient fade on left edge */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 hidden sm:block" />

      {/* Scrollable container */}
      <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
        <TabsList
          className={cn(
            "inline-flex w-auto min-w-full sm:min-w-0",
            className
          )}
          {...props}
        >
          {children}
        </TabsList>
      </div>

      {/* Gradient fade on right edge */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 hidden sm:block" />
    </div>
  );
}

/**
 * CompactScrollableTabsList - For situations with many tabs
 *
 * This variant uses smaller text and padding on mobile for better space utilization
 * when you have 5+ tabs.
 */
export function CompactScrollableTabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <div className="relative w-full">
      <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
        <TabsList
          className={cn(
            "inline-flex w-auto min-w-full sm:min-w-0",
            "[&>button]:text-xs [&>button]:px-2 sm:[&>button]:text-sm sm:[&>button]:px-3",
            className
          )}
          {...props}
        >
          {children}
        </TabsList>
      </div>
    </div>
  );
}
