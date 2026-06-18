"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { acceptFriendRequest } from "@/lib/friends-actions";
import { MotionSpinner } from "@/components/motion-spinner";

interface AcceptFriendRequestButtonProps {
  requestId: string;
}

export function AcceptFriendRequestButton({
  requestId,
}: AcceptFriendRequestButtonProps) {
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptFriendRequest(requestId);
      // Server Action automatically revalidates the page
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAccept}
      disabled={isAccepting}
      data-testid="accept-friend-request-button"
      className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-500 px-5 py-2.5 text-sm font-medium text-cream-50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
    >
      {isAccepting ? (
        <>
          <MotionSpinner size="sm" className="text-cream-50" />
          Accepting…
        </>
      ) : (
        <>
          <Check className="h-4 w-4" aria-hidden />
          Accept
        </>
      )}
    </button>
  );
}
