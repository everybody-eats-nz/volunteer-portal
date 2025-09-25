"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { declineFriendRequest } from "@/lib/friends-actions";

interface DeclineFriendRequestButtonProps {
  requestId: string;
}

export function DeclineFriendRequestButton({ requestId }: DeclineFriendRequestButtonProps) {
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleDecline}
      disabled={isDeclining}
      data-testid="decline-friend-request-button"
    >
      {isDeclining ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-1" />
          Declining...
        </>
      ) : (
        <>
          <X className="h-4 w-4 mr-1" />
          Decline
        </>
      )}
    </Button>
  );
}