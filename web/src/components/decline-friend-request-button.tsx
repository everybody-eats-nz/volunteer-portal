"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { declineFriendRequest } from "@/lib/friends-actions";
import { MotionSpinner } from "@/components/motion-spinner";

interface DeclineFriendRequestButtonProps {
  requestId: string;
}

export function DeclineFriendRequestButton({
  requestId,
}: DeclineFriendRequestButtonProps) {
  const [isDeclining, setIsDeclining] = useState(false);

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await declineFriendRequest(requestId);
      // Server Action automatically revalidates the page
    } catch (error) {
      console.error("Failed to decline friend request:", error);
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDecline}
      disabled={isDeclining}
      data-testid="decline-friend-request-button"
      className="inline-flex items-center justify-center gap-2 rounded-full border border-forest-500/30 px-5 py-2.5 text-sm font-medium text-forest-700 transition-all duration-200 hover:border-forest-700 hover:bg-forest-700 hover:text-cream-50 disabled:pointer-events-none disabled:opacity-60 dark:border-cream-50/30 dark:text-cream-50 dark:hover:border-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
    >
      {isDeclining ? (
        <>
          <MotionSpinner size="sm" />
          Declining…
        </>
      ) : (
        <>
          <X className="h-4 w-4" aria-hidden />
          Decline
        </>
      )}
    </button>
  );
}
