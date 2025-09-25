"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { acceptFriendRequest } from "@/lib/friends-actions";
import { MotionSpinner } from "@/components/motion-spinner";

interface AcceptFriendRequestButtonProps {
  requestId: string;
}

export function AcceptFriendRequestButton({ requestId }: AcceptFriendRequestButtonProps) {
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
    <Button
      size="sm"
      onClick={handleAccept}
      disabled={isAccepting}
      className="bg-green-600 hover:bg-green-700"
      data-testid="accept-friend-request-button"
    >
      {isAccepting ? (
        <>
          <MotionSpinner className="h-4 w-4 border-b-2 border-white mr-1" />
          Accepting...
        </>
      ) : (
        <>
          <Check className="h-4 w-4 mr-1" />
          Accept
        </>
      )}
    </Button>
  );
}