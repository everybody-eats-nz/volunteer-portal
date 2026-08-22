"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { formatInNZT } from "@/lib/timezone";
import { sendFriendRequestByUserId } from "@/lib/friends-actions";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionSpinner } from "@/components/motion-spinner";
import {
  type RecommendedFriend,
  getRecommendedFriendDisplayName,
  getRecommendedFriendInitials,
} from "@/lib/friends-utils";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/** Dark forest panel — the marketing site's "app section" treatment, with the
    sun glow as a radial gradient (NOT blur-3xl, which escapes the corner clip
    on composited layers in Chromium). */
function SuggestionsPanel({ children }: { children: React.ReactNode }) {
  return (
    <section
      data-testid="recommended-friends-section"
      className="grain relative overflow-hidden rounded-[2rem] bg-forest-700 px-6 py-10 text-cream-50 sm:px-10 sm:py-12"
    >
      <div
        className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.16),transparent)]"
        aria-hidden
      />
      <div className="relative">
        <p className="eyebrow mb-4 flex items-center gap-3 text-sun-200/90">
          <span className="inline-block h-px w-8 bg-sun-200/50" />
          People you may know
        </p>
        {children}
      </div>
    </section>
  );
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
      <SuggestionsPanel>
        <div className="h-9 w-64 animate-pulse rounded-full bg-cream-50/10" />
        <div className="mt-8 grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-cream-50/[0.06] p-5 ring-1 ring-cream-50/10"
            >
              <div className="h-12 w-12 rounded-full bg-cream-50/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded-full bg-cream-50/10" />
                <div className="h-3 w-24 rounded-full bg-cream-50/10" />
              </div>
            </div>
          ))}
        </div>
      </SuggestionsPanel>
    );
  }

  if (recommendedFriends.length === 0) {
    return (
      <div data-testid="recommended-friends-empty">
        <SuggestionsPanel>
          <h2 className="display text-3xl tracking-tight sm:text-4xl">
            Met someone on a <em>shift</em>?
          </h2>
          <p className="mt-4 max-w-xl leading-relaxed text-cream-50/80">
            Sign up for more shifts to see suggestions here. Once you&apos;ve
            shared 3+ shifts with another volunteer in the last 3 months,
            they&apos;ll show up as a suggested friend.
          </p>
          <Link
            href="/shifts"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-sun-200 px-6 py-3 text-sm font-medium text-forest-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sun-300 hover:shadow-lg active:translate-y-0"
          >
            <Calendar className="h-4 w-4" aria-hidden />
            Browse shifts
          </Link>
        </SuggestionsPanel>
      </div>
    );
  }

  return (
    <SuggestionsPanel>
      <h2 className="display text-3xl tracking-tight sm:text-4xl">
        Familiar faces from the <em>kitchen</em>
      </h2>
      <p className="mt-4 max-w-xl leading-relaxed text-cream-50/80">
        Volunteers you&apos;ve recently worked with — 3+ shared shifts in the
        last 3 months.
      </p>

      <motion.div
        className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {recommendedFriends.map((friend) => {
          const displayName = getRecommendedFriendDisplayName(friend);
          const initials = getRecommendedFriendInitials(friend);
          const isSending = sendingRequest.has(friend.id);

          return (
            <motion.div
              key={friend.id}
              variants={staggerItem}
              data-testid="recommended-friend-card"
              className="flex flex-col rounded-2xl bg-cream-50/[0.06] p-5 ring-1 ring-cream-50/15 transition-all duration-200 hover:bg-cream-50/[0.1] hover:ring-cream-50/25"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0 ring-2 ring-cream-50/20">
                  <AvatarImage
                    src={friend.profilePhotoUrl || undefined}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-cream-50/15 font-semibold text-cream-50">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="display display-medium truncate text-lg leading-tight tracking-tight">
                    {displayName}
                  </h3>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sun-200/15 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-sun-100">
                    <Sparkle className="h-2.5 w-2.5 text-sun-200" />
                    {friend.sharedShiftsCount} shared shifts
                  </span>
                </div>
              </div>

              {/* Recent shared shifts */}
              {friend.recentSharedShifts.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-cream-50/65">
                  {friend.recentSharedShifts.slice(0, 2).map((shift) => (
                    <li key={shift.id} className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {shift.shiftTypeName} ·{" "}
                        {formatInNZT(new Date(shift.start), "MMM d")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => handleSendRequest(friend.id, displayName)}
                disabled={isSending}
                data-testid="recommended-add-friend-button"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-sun-200 px-5 py-2.5 text-sm font-medium text-forest-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sun-300 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
              >
                {isSending ? (
                  <>
                    <MotionSpinner size="sm" />
                    Sending…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Add Friend
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </SuggestionsPanel>
  );
}
