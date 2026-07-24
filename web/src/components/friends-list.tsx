import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import { RemoveFriendButton } from "./remove-friend-button";
import { ViewFriendProfileButton } from "./view-friend-profile-button";
import { differenceInDays } from "date-fns";
import { motion } from "motion/react";
import { staggerContainer } from "@/lib/motion";
import { MotionFriendCard } from "./motion-friends";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

interface FriendsListProps {
  friends: Friend[];
  searchTerm: string;
  onAddFriend?: () => void;
}

export function FriendsList({
  friends,
  searchTerm,
  onAddFriend,
}: FriendsListProps) {
  const filteredFriends = friends.filter(
    (friend) =>
      friend.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredFriends.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="rounded-[2rem] border border-dashed border-forest-500/20 px-6 py-14 text-center sm:py-16 dark:border-cream-50/20">
          <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
            <Users
              className="h-8 w-8 text-forest-500 dark:text-cream-50/70"
              aria-hidden
            />
            <Sparkle className="absolute -right-2 -top-2 h-5 w-5 text-sun-300" />
          </div>

          <h3 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
            {searchTerm ? (
              <>
                No <em>matches</em> found
              </>
            ) : (
              <>
                No friends <em>yet</em>
              </>
            )}
          </h3>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-forest-700/70 dark:text-cream-50/70">
            {searchTerm
              ? "Try adjusting your search terms to find the friends you're looking for."
              : "Your volunteering whānau starts here — connect with the people you serve alongside and plan your next shift together."}
          </p>

          {!searchTerm && onAddFriend && (
            <button
              type="button"
              onClick={onAddFriend}
              data-testid="empty-state-add-friend-button"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-forest-500 px-7 py-3.5 text-sm font-medium text-cream-50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lg active:translate-y-0"
            >
              Add your first friend
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section kicker + search results indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
          <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
          Your whānau
          <span className="text-forest-500/60 dark:text-cream-50/45">
            · {filteredFriends.length}{" "}
            {filteredFriends.length === 1 ? "friend" : "friends"}
            {searchTerm && " found"}
          </span>
        </p>
        {searchTerm && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center rounded-full bg-sun-100 px-3 py-1 text-xs font-medium text-forest-700 dark:bg-sun-200/15 dark:text-sun-100"
          >
            Searching for &quot;{searchTerm}&quot;
          </motion.span>
        )}
      </div>

      <motion.div
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {filteredFriends.map((friend) => {
          const displayName =
            friend.name ||
            `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
            friend.email;
          const friendsSinceDate = new Date(friend.friendsSince);
          const daysSinceFriendship = differenceInDays(
            new Date(),
            friendsSinceDate
          );
          const isRecentFriend = daysSinceFriendship <= 30;

          return (
            <MotionFriendCard key={friend.friendshipId}>
              <div className="group flex h-full flex-col rounded-3xl border border-forest-500/10 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-forest-500 focus-within:ring-offset-2 dark:border-cream-50/10">
                <div className="flex flex-1 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 ring-2 ring-forest-500/15 dark:ring-cream-50/15">
                        <AvatarImage
                          src={friend.profilePhotoUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-forest-500/10 font-semibold text-forest-700 dark:bg-cream-50/10 dark:text-cream-50">
                          {(
                            friend.firstName?.[0] ||
                            friend.name?.[0] ||
                            friend.email[0]
                          ).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isRecentFriend && (
                        <motion.div
                          aria-hidden
                          className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-card bg-sun-200"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.2 }}
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="display display-medium truncate text-lg leading-tight tracking-tight text-forest-700 dark:text-cream-50">
                        {displayName}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-forest-700/65 dark:text-cream-50/60">
                        Friends for{" "}
                        {daysSinceFriendship === 0
                          ? "today"
                          : daysSinceFriendship === 1
                          ? "1 day"
                          : `${daysSinceFriendship} days`}
                      </p>
                      {isRecentFriend && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sun-100 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700 dark:bg-sun-200/15 dark:text-sun-100">
                          <Sparkle className="h-2.5 w-2.5 text-sun-300" />
                          New
                        </span>
                      )}
                    </div>
                  </div>
                  <RemoveFriendButton friendId={friend.id} />
                </div>

                {/* Action button */}
                <div className="mt-5">
                  <ViewFriendProfileButton friend={friend} />
                </div>
              </div>
            </MotionFriendCard>
          );
        })}
      </motion.div>
    </div>
  );
}
