"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface InvitationActionsProps {
  token: string;
}

export function InvitationActions({ token }: InvitationActionsProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    try {
      const response = await fetch(`/api/group-invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        // Success - redirect to dashboard or success page
        router.push("/dashboard?groupJoined=true");
      } else {
        setError(data.error || "Failed to accept invitation");
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError("Failed to accept invitation. Please try again.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    setError(null);

    try {
      const response = await fetch(`/api/group-invitations/${token}/decline`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        // Success - show confirmation and refresh
        router.refresh();
      } else {
        setError(data.error || "Failed to decline invitation");
      }
    } catch (error) {
      console.error("Error declining invitation:", error);
      setError("Failed to decline invitation. Please try again.");
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleDecline}
          variant="outline"
          disabled={isDeclining || isAccepting}
          className="flex-1"
          data-testid="decline-invitation-button"
        >
          {isDeclining ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Declining...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Decline
            </span>
          )}
        </Button>

        <Button
          onClick={handleAccept}
          disabled={isAccepting || isDeclining}
          className="flex-1"
          data-testid="accept-invitation-button"
        >
          {isAccepting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Joining...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Accept & Join Group
            </span>
          )}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        By accepting, you&apos;ll be added to the group and signed up for the volunteer shift.
      </p>
    </div>
  );
}