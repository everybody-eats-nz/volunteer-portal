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
    <Card className="grain relative overflow-hidden rounded-3xl border-forest-500/10 bg-card dark:border-cream-50/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300" />
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sun-200 text-forest-700 ring-1 ring-forest-500/10 dark:bg-sun-200/20 dark:text-sun-200 dark:ring-cream-50/10">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
              Suggested Friends
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href="/friends"
              className="text-xs text-forest-700/70 hover:text-forest-700 dark:text-cream-50/65 dark:hover:text-cream-50"
            >
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-forest-700/65 dark:text-cream-50/60">
          Volunteers you&apos;ve recently worked with
        </p>
      </CardHeader>
      <CardContent>
        {displayFriends.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-forest-700/70 dark:text-cream-50/65">
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
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest-500/10 bg-card p-3 transition-colors hover:border-forest-500/25 dark:border-cream-50/10 dark:hover:border-cream-50/25">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 ring-2 ring-forest-500/15 dark:ring-cream-50/15">
                        <AvatarImage
                          src={friend.profilePhotoUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-forest-500/10 text-forest-700 font-semibold text-sm dark:bg-cream-50/10 dark:text-cream-50/85">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="truncate text-sm font-semibold text-forest-700 dark:text-cream-50">
                          {displayName}
                        </h3>
                        <div className="flex items-center gap-2">
                          {friend.isPendingRequest ? (
                            <Badge
                              variant="secondary"
                              className="border-amber-300/60 bg-amber-50 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                            >
                              Friend request
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="border border-forest-500/15 bg-forest-500/8 text-xs text-forest-700 dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50/85"
                            >
                              {friend.sharedShiftsCount} shared shifts
                            </Badge>
                          )}
                          {!friend.isPendingRequest && friend.recentSharedShifts[0] && (
                            <span className="flex items-center gap-1 text-xs text-forest-700/60 dark:text-cream-50/55">
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
