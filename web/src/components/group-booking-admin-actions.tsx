"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface GroupBookingAdminActionsProps {
  groupBookingId: string;
  status: string;
  groupName: string;
  hasIncompleteMembers?: boolean;
  hasPendingInvitations?: boolean;
}

export function GroupBookingAdminActions({
  groupBookingId,
  status,
  hasIncompleteMembers = false,
  hasPendingInvitations = false,
}: GroupBookingAdminActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const updateGroupStatus = async (newStatus: "CONFIRMED" | "CANCELED") => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/group-bookings/${groupBookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          notes: `${newStatus === "CONFIRMED" ? "Approved" : "Rejected"} by admin`,
        }),
      });

      if (response.ok) {
        // Refresh the page to show updated status
        router.refresh();
      } else {
        const errorData = await response.json();
        console.error("Failed to update group status:", errorData);
        setError(errorData.error || "Failed to update group status");
      }
    } catch (error) {
      console.error("Error updating group status:", error);
      setError("An error occurred while updating the group status");
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== "PENDING") {
    return (
      <Badge 
        variant="outline"
        className={`text-xs ${
          status === "CONFIRMED"
            ? "bg-green-50 text-green-700 border-green-200"
            : status === "CANCELED"
            ? "bg-red-50 text-red-700 border-red-200"
            : status === "PARTIAL"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : status === "WAITLISTED"
            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
            : "bg-gray-50 text-gray-700 border-gray-200"
        }`}
      >
        {status.toLowerCase()}
      </Badge>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 hover:bg-green-50 border-green-300"
          onClick={() => updateGroupStatus("CONFIRMED")}
          disabled={isLoading || hasIncompleteMembers || hasPendingInvitations}
          title={
            hasPendingInvitations 
              ? "Some invited members have not joined yet" 
              : hasIncompleteMembers 
              ? "Some members have not completed registration" 
              : undefined
          }
          data-testid={`approve-group-${groupBookingId}`}
        >
          {isLoading ? "..." : "Approve Group"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:bg-red-50 border-red-300"
          onClick={() => updateGroupStatus("CANCELED")}
          disabled={isLoading}
          data-testid={`reject-group-${groupBookingId}`}
        >
          {isLoading ? "..." : "Reject Group"}
        </Button>
      </div>
      {hasPendingInvitations && (
        <p className="text-xs text-amber-600">
          ⚠️ Some invited members have not joined yet
        </p>
      )}
      {hasIncompleteMembers && (
        <p className="text-xs text-amber-600">
          ⚠️ Some members have incomplete profiles
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600">
          ❌ {error}
        </p>
      )}
    </div>
  );
}