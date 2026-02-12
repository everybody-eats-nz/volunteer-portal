"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles, Calendar, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { formatInNZT } from "@/lib/timezone";
import { sendFriendRequestByUserId } from "@/lib/friends-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MotionSpinner } from "@/components/motion-spinner";
import Link from "next/link";
import {
  type RecommendedFriend,
  getRecommendedFriendDisplayName,
  getRecommendedFriendInitials,
} from "@/lib/friends-utils";

interface DashboardSuggestedFriendsListProps {
  friends: RecommendedFriend[];
}

export function DashboardSuggestedFriendsList({
  friends,
}: DashboardSuggestedFriendsListProps) {
  const router = useRouter();
  const [sendingRequest, setSendingRequest] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const handleSendRequest = async (userId: string, displayName: string) => {
    setSendingRequest((prev) => new Set(prev).add(userId));

    try {
      const result = await sendFriendRequestByUserId(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Friend request sent to ${displayName}`);
        setHiddenIds((prev) => new Set(prev).add(userId));
        router.refresh();
      }
    } catch {
      toast.error("Failed to send friend request");
    } finally {
      setSendingRequest((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const visibleFriends = friends.filter((f) => !hiddenIds.has(f.id));

  if (visibleFriends.length === 0) {
    return null;
  }

  // Show at most 3 on the dashboard
  const displayFriends = visibleFriends.slice(0, 3);
  const hasMore = visibleFriends.length > 3;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Suggested Friends
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/friends" className="text-xs text-muted-foreground">
              View all
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Volunteers you&apos;ve recently worked with
        </p>
      </CardHeader>
      <CardContent>
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {displayFriends.map((friend) => {
            const displayName = getRecommendedFriendDisplayName(friend);
            const initials = getRecommendedFriendInitials(friend);

            return (
              <motion.div key={friend.id} variants={staggerItem}>
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage
                        src={friend.profilePhotoUrl || undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 text-xs"
                        >
                          {friend.sharedShiftsCount} shared shifts
                        </Badge>
                        {friend.recentSharedShifts[0] && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {friend.recentSharedShifts[0].shiftTypeName} &bull;{" "}
                            {formatInNZT(
                              new Date(friend.recentSharedShifts[0].start),
                              "MMM d"
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleSendRequest(friend.id, displayName)}
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
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
        {hasMore && (
          <div className="mt-3 text-center">
            <Button variant="link" size="sm" asChild>
              <Link href="/friends">
                View {visibleFriends.length - 3} more suggestion
                {visibleFriends.length - 3 !== 1 ? "s" : ""}
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
