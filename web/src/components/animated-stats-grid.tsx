"use client";

import * as React from "react";
import { motion } from "motion/react";
import { StatsGrid } from "@/components/dashboard-animated";
import { StatsCard } from "@/components/ui/stats-card";
import { staggerItem, staggerContainer } from "@/lib/motion";
import { CheckCircle, Clock, Calendar, TrendingUp, Timer, Heart, Handshake } from "lucide-react";

interface StatData {
  title: string;
  value: string | number;
  subtitle?: string;
  iconType: "checkCircle" | "clock" | "calendar" | "trendingUp" | "timer" | "heart" | "handshake";
  variant: "green" | "blue" | "purple" | "amber" | "red" | "primary";
  testId?: string;
}

interface AnimatedStatsGridProps {
  stats: StatData[];
  useStatsGrid?: boolean;
  className?: string;
  "data-testid"?: string;
}

const iconMap = {
  checkCircle: CheckCircle,
  clock: Clock,
  calendar: Calendar,
  trendingUp: TrendingUp,
  timer: Timer,
  heart: Heart,
  handshake: Handshake,
};

export function AnimatedStatsGrid({ stats, useStatsGrid = true, className, "data-testid": dataTestId }: AnimatedStatsGridProps) {
  const content = stats.map((stat, index) => (
    <motion.div key={index} variants={staggerItem}>
      <StatsCard
        title={stat.title}
        value={stat.value}
        subtitle={stat.subtitle}
        icon={iconMap[stat.iconType]}
        variant={stat.variant}
        testId={stat.testId}
      />
    </motion.div>
  ));

  if (useStatsGrid) {
    return <StatsGrid>{content}</StatsGrid>;
  }

  return (
    <motion.div
      className={className}
      data-testid={dataTestId}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {content}
    </motion.div>
  );
}