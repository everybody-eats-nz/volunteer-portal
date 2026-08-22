import { Lock } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import Link from "next/link";

interface ViewFriendProfileButtonProps {
  friend: Friend;
}

export function ViewFriendProfileButton({
  friend,
}: ViewFriendProfileButtonProps) {
  // If friend has private visibility, show disabled button
  if (friend.friendVisibility === "PRIVATE") {
    return (
      <button
        type="button"
        disabled
        data-testid="view-friend-profile-button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-forest-500/15 px-5 py-2.5 text-sm font-medium text-forest-700/50 dark:border-cream-50/15 dark:text-cream-50/50"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Profile Private
      </button>
    );
  }

  return (
    <Link
      href={`/friends/${friend.id}`}
      data-testid="view-friend-profile-button"
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-forest-500/30 px-5 py-2.5 text-sm font-medium text-forest-700 transition-all duration-200 hover:border-forest-700 hover:bg-forest-700 hover:text-cream-50 dark:border-cream-50/30 dark:text-cream-50 dark:hover:border-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
    >
      View Profile
    </Link>
  );
}
