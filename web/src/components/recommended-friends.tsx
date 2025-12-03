"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles, Calendar } from "lucide-react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { formatInNZT } from "@/lib/timezone";
import { sendFriendRequestByUserId } from "@/lib/friends-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MotionSpinner } from "@/components/motion-spinner";

interface RecommendedFriend {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  sharedShiftsCount: number;
  recentSharedShifts: Array<{
    id: string;
    start: Date;
    shiftTypeName: string;
    location: string | null;
  }>;
}

export function RecommendedFriends() {
  const router = useRouter();
  const [recommendedFriends, setRecommendedFriends] = useState<
    RecommendedFriend[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRecommendedFriends();
  }, []);

  const fetchRecommendedFriends = async () => {
    try {
      const response = await fetch("/api/friends/recommended");
      if (response.ok) {
        const data = await response.json();
        setRecommendedFriends(data.recommendedFriends || []);
      }
    } catch (error) {
      console.error("Error fetching recommended friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (userId: string, displayName: string) => {
    setSendingRequest((prev) => new Set(prev).add(userId));

    try {
      const result = await sendFriendRequestByUserId(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Friend request sent to ${displayName}`);
        // Refresh to update the recommendations list
        router.refresh();
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    } finally {
      setSendingRequest((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggested Friends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg animate-pulse"
              >
                <div className="h-10 w-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendedFriends.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Suggested Friends
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Volunteers you&apos;ve recently worked with (3+ shared shifts in the
          last 3 months)
        </p>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {recommendedFriends.map((friend) => {
            const displayName =
              friend.name ||
              `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
              "Volunteer";
            const initials = (
              friend.firstName?.[0] ||
              friend.name?.[0] ||
              "V"
            ).toUpperCase();

            return (
              <motion.div key={friend.id} variants={staggerItem}>
                <Card className="group hover:border-primary/50 transition-all shadow-sm hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20 shadow-sm">
                          <AvatarImage
                            src={friend.profilePhotoUrl || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate mb-1">
                            {displayName}
                          </h3>
                          <div className="flex flex-wrap gap-1.5 items-center mb-2">
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20 text-xs"
                            >
                              {friend.sharedShiftsCount} shared shifts
                            </Badge>
                          </div>

                          {/* Recent shared shifts */}
                          {friend.recentSharedShifts.length > 0 && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {friend.recentSharedShifts
                                .slice(0, 2)
                                .map((shift) => (
                                  <div
                                    key={shift.id}
                                    className="flex items-center gap-1"
                                  >
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {shift.shiftTypeName} •{" "}
                                      {formatInNZT(
                                        new Date(shift.start),
                                        "MMM d"
                                      )}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="default"
                        onClick={() =>
                          handleSendRequest(friend.id, displayName)
                        }
                        disabled={sendingRequest.has(friend.id)}
                        className="flex-shrink-0"
                      >
                        {sendingRequest.has(friend.id) ? (
                          <>
                            <MotionSpinner size="sm" className="mr-1" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3 mr-1" />
                            Add Friend
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
