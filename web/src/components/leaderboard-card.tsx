"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface LeaderboardUser {
  rank: number;
  name: string;
  points: number;
  achievementCount: number;
  isCurrentUser: boolean;
}

interface LeaderboardData {
  userRank: number;
  totalUsers: number;
  percentile: number;
  nearbyUsers: LeaderboardUser[];
  locations: string[];
  hasMoreAbove: boolean;
}

export function LeaderboardCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Reset showAll when location changes
    setShowAll(false);
  }, [selectedLocation]);

  useEffect(() => {
    // Only fetch when panel is open
    if (isOpen) {
      fetchLeaderboard(selectedLocation, showAll);
    }
  }, [selectedLocation, isOpen, showAll]);

  const fetchLeaderboard = async (location: string, showAllUsers: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?location=${location}&showAll=${showAllUsers}`);
      if (response.ok) {
        const leaderboardData = await response.json();
        setData(leaderboardData);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Editorial cream panel (the home page's feature-card surface) with the
          page's single warm sun moment on the trophy tile. */}
      <section
        className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-cream-100 dark:border-cream-50/10 dark:bg-forest-800/60"
        data-testid="leaderboard-panel"
      >
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex flex-1 cursor-pointer items-center gap-4 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sun-200 text-forest-700 shadow-sm dark:bg-sun-200/20 dark:text-sun-200">
                <Trophy className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="display block text-2xl tracking-tight text-forest-700 dark:text-cream-50">
                  Leaderboard
                </span>
                <span className="mt-0.5 block text-sm text-forest-700/65 dark:text-cream-50/60">
                  See how your mahi stacks up across the whānau
                </span>
              </span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-forest-500/20 text-forest-500 transition-colors group-hover:border-forest-500/40 group-hover:bg-forest-500/5 dark:border-cream-50/20 dark:text-cream-50/70 dark:group-hover:border-cream-50/40 dark:group-hover:bg-cream-50/5">
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          {isOpen && data?.locations?.length && data.locations.length > 0 && (
            <Select
              value={selectedLocation}
              onValueChange={setSelectedLocation}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {data?.locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="rounded-full h-8 w-8 border-b-2 border-forest-500 dark:border-cream-50/70"
                />
              </div>
            ) : (
              data && (
                <div className="space-y-4">
                  {data.hasMoreAbove && !showAll && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAll(true)}
                        className="text-sm"
                      >
                        Show All Above Me ({data.userRank - 1} more)
                      </Button>
                    </div>
                  )}
                  {showAll && data.userRank > 4 && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAll(false)}
                        className="text-sm"
                      >
                        Show Less
                      </Button>
                    </div>
                  )}
                  <motion.div
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {data.nearbyUsers.map((user) => (
                    <motion.div
                      key={user.rank}
                      variants={staggerItem}
                      className={`grain relative overflow-hidden flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        user.isCurrentUser
                          ? "border-forest-500/20 bg-gradient-to-r from-sun-200/50 to-sun-100/40 dark:border-cream-50/15 dark:from-sun-200/15 dark:to-sun-200/5"
                          : "border-forest-500/10 bg-card dark:border-cream-50/10 dark:bg-cream-50/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                            user.rank === 1
                              ? "bg-yellow-400 text-yellow-900"
                              : user.rank === 2
                              ? "bg-gray-300 text-gray-900"
                              : user.rank === 3
                              ? "bg-orange-400 text-orange-900"
                              : "bg-forest-500/10 text-forest-700 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10"
                          } font-bold text-sm`}
                        >
                          {user.rank}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2 text-forest-700 dark:text-cream-50">
                            <span className="truncate">{user.name}</span>
                            {user.isCurrentUser && (
                              <Badge
                                variant="secondary"
                                className="text-xs flex-shrink-0 border border-forest-500/15 bg-forest-500/10 text-forest-700 dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50/85"
                              >
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-forest-700/60 dark:text-cream-50/55">
                            {user.achievementCount} achievements
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-accent text-lg font-bold tabular-nums text-forest-700 dark:text-cream-50">
                          {user.points}
                        </div>
                        <div className="text-xs text-forest-700/55 dark:text-cream-50/50">
                          points
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  </motion.div>
                </div>
              )
            )}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
