"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

export function LeaderboardCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only fetch when panel is open
    if (isOpen) {
      fetchLeaderboard(selectedLocation);
    }
  }, [selectedLocation, isOpen]);

  const fetchLeaderboard = async (location: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leaderboard?location=${location}`);
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
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 p-0 hover:bg-transparent -ml-1"
              >
                <Trophy className="h-5 w-5" />
                <CardTitle className="text-lg">Leaderboard</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isOpen ? "transform rotate-180" : ""
                  }`}
                />
              </Button>
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
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="rounded-full h-8 w-8 border-b-2 border-primary"
                />
              </div>
            ) : (
              data && (
                <motion.div
                  className="space-y-2"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {data.nearbyUsers.map((user) => (
                    <motion.div
                      key={user.rank}
                      variants={staggerItem}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        user.isCurrentUser
                          ? "bg-linear-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-200 dark:border-yellow-700"
                          : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            user.rank === 1
                              ? "bg-yellow-400 text-yellow-900"
                              : user.rank === 2
                              ? "bg-gray-300 text-gray-900"
                              : user.rank === 3
                              ? "bg-orange-400 text-orange-900"
                              : "bg-muted text-muted-foreground"
                          } font-bold text-sm`}
                        >
                          {user.rank}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.name}
                            {user.isCurrentUser && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.achievementCount} achievements
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{user.points}</div>
                        <div className="text-xs text-muted-foreground">
                          points
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
