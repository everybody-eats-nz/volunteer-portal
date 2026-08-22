import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock, Mail } from "lucide-react";
import { FriendRequest } from "@/lib/friends-data";
import { AcceptFriendRequestButton } from "./accept-friend-request-button";
import { DeclineFriendRequestButton } from "./decline-friend-request-button";
import { differenceInDays, format } from "date-fns";
import { motion } from "motion/react";
import { staggerContainer } from "@/lib/motion";
import { MotionFriendRequest } from "./motion-friends";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

interface FriendRequestsListProps {
  pendingRequests: FriendRequest[];
}

export function FriendRequestsList({
  pendingRequests,
}: FriendRequestsListProps) {
  if (pendingRequests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="rounded-[2rem] border border-dashed border-forest-500/20 px-6 py-14 text-center sm:py-16 dark:border-cream-50/20">
          <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
            <Mail
              className="h-8 w-8 text-forest-500 dark:text-cream-50/70"
              aria-hidden
            />
            <Sparkle className="absolute -right-2 -top-2 h-5 w-5 text-sun-300" />
          </div>

          <h3 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
            All caught up — <em>ka pai!</em>
          </h3>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-forest-700/70 dark:text-cream-50/70">
            You don&apos;t have any pending friend requests right now. When
            someone sends you one, it will appear here.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
        <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
        Waiting on you
        <span className="text-forest-500/60 dark:text-cream-50/45">
          · {pendingRequests.length}
        </span>
      </p>

      <motion.div
        className="space-y-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {pendingRequests.map((request) => {
          const displayName =
            request.fromUser.name ||
            `${request.fromUser.firstName || ""} ${
              request.fromUser.lastName || ""
            }`.trim() ||
            request.fromUser.email;
          const daysAgo = differenceInDays(
            new Date(),
            new Date(request.createdAt)
          );
          const isRecent = daysAgo <= 1;

          return (
            <MotionFriendRequest key={request.id} isNew={isRecent}>
              <div className="group rounded-3xl border border-forest-500/10 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-lg focus-within:ring-2 focus-within:ring-forest-500 focus-within:ring-offset-2 sm:p-6 dark:border-cream-50/10">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  {/* User info section */}
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="relative shrink-0">
                      <Avatar className="h-14 w-14 ring-2 ring-forest-500/15 dark:ring-cream-50/15">
                        <AvatarImage
                          src={request.fromUser.profilePhotoUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-forest-500/10 text-lg font-semibold text-forest-700 dark:bg-cream-50/10 dark:text-cream-50">
                          {(
                            request.fromUser.firstName?.[0] ||
                            request.fromUser.name?.[0] ||
                            request.fromUser.email[0]
                          ).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isRecent && (
                        <motion.div
                          aria-hidden
                          className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-card bg-sun-200"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.2 }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="display display-medium text-xl leading-tight tracking-tight text-forest-700 dark:text-cream-50">
                            {displayName}
                          </h3>
                          {isRecent && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sun-200 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700">
                              New request
                            </span>
                          )}
                        </div>

                        <p className="flex items-center gap-1.5 text-sm text-forest-700/65 dark:text-cream-50/60">
                          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {daysAgo === 0
                            ? "Sent today"
                            : daysAgo === 1
                            ? "Sent yesterday"
                            : daysAgo <= 7
                            ? `Sent ${daysAgo} days ago`
                            : `Sent ${format(
                                new Date(request.createdAt),
                                "MMM d, yyyy"
                              )}`}
                        </p>
                      </div>

                      {request.message && (
                        <blockquote className="rounded-2xl bg-sun-100/70 px-4 py-3 text-sm italic leading-relaxed text-forest-700/90 ring-1 ring-forest-500/10 dark:bg-sun-200/10 dark:text-cream-50/85 dark:ring-cream-50/10">
                          &quot;{request.message}&quot;
                        </blockquote>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:pt-1">
                    <AcceptFriendRequestButton requestId={request.id} />
                    <DeclineFriendRequestButton requestId={request.id} />
                  </div>
                </div>
              </div>
            </MotionFriendRequest>
          );
        })}
      </motion.div>
    </div>
  );
}
