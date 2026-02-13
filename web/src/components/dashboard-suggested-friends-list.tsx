"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Sparkles, Calendar, ArrowRight, Check, X } from "lucide-react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { formatInNZT } from "@/lib/timezone";
import { sendFriendRequestByUserId, acceptFriendRequest, declineFriendRequest } from "@/lib/friends-actions";
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
  const [acceptingRequest, setAcceptingRequest] = useState<Set<string>>(new Set());
  const [decliningRequest, setDecliningRequest] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // Compute visible and display friends from hiddenIds
  const visibleFriends = useMemo(
    () => friends.filter((f) => !hiddenIds.has(f.id)),
    [friends, hiddenIds]
  );

  const displayFriends = useMemo(
    () => visibleFriends.slice(0, 3),
    [visibleFriends]
  );

  const handleSendRequest = async (userId: string, displayName: string) => {
    setSendingRequest((prev) => new Set(prev).add(userId));

    try {
      const result = await sendFriendRequestByUserId(userId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Friend request sent to ${displayName}`);

        // Hide this friend from the list
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

  const handleAcceptRequest = async (requestId: string, displayName: string, userId: string) => {
    setAcceptingRequest((prev) => new Set(prev).add(userId));

    try {
      const result = await acceptFriendRequest(requestId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`You are now friends with ${displayName}`);

        // Hide this friend from the list
        setHiddenIds((prev) => new Set(prev).add(userId));

        router.refresh();
      }
    } catch {
      toast.error("Failed to accept friend request");
    } finally {
      setAcceptingRequest((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleDeclineRequest = async (requestId: string, displayName: string, userId: string) => {
    setDecliningRequest((prev) => new Set(prev).add(userId));

    try {
      const result = await declineFriendRequest(requestId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Declined friend request from ${displayName}`);

        // Hide this friend from the list
        setHiddenIds((prev) => new Set(prev).add(userId));

        router.refresh();
      }
    } catch {
      toast.error("Failed to decline friend request");
    } finally {
      setDecliningRequest((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const hasMore = visibleFriends.length > 3;

  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-background to-background">
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
        {displayFriends.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              No new suggestions right now
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/friends">
                View Your Friends
              </Link>
            </Button>
          </div>
        ) : (
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
                          {friend.isPendingRequest ? (
                            <Badge
                              variant="secondary"
                              className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs"
                            >
                              Friend request
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary border-primary/20 text-xs"
                            >
                              {friend.sharedShiftsCount} shared shifts
                            </Badge>
                          )}
                          {!friend.isPendingRequest && friend.recentSharedShifts[0] && (
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

                    {friend.isPendingRequest && friend.requestId ? (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAcceptRequest(friend.requestId!, displayName, friend.id)}
                          disabled={acceptingRequest.has(friend.id) || decliningRequest.has(friend.id)}
                          className="flex-shrink-0"
                        >
                          {acceptingRequest.has(friend.id) ? (
                            <>
                              <MotionSpinner size="sm" className="mr-1" />
                              Accepting...
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Accept
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineRequest(friend.requestId!, displayName, friend.id)}
                          disabled={acceptingRequest.has(friend.id) || decliningRequest.has(friend.id)}
                          className="flex-shrink-0"
                        >
                          {decliningRequest.has(friend.id) ? (
                            <>
                              <MotionSpinner size="sm" className="mr-1" />
                              Declining...
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3 mr-1" />
                              Decline
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
        {displayFriends.length > 0 && hasMore && (
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
