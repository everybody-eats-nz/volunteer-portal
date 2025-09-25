"use client";

import { useState } from "react";
import { SignupActions } from "./signup-actions";
import { Badge } from "@/components/ui/badge";

interface SignupActionsWrapperProps {
  signupId: string;
  initialStatus:
    | "PENDING"
    | "CONFIRMED"
    | "WAITLISTED"
    | "CANCELED"
    | "NO_SHOW"
    | "REGULAR_PENDING";
  isAutoSignup?: boolean;
}

export function SignupActionsWrapper({
  signupId,
  initialStatus,
  isAutoSignup,
}: SignupActionsWrapperProps) {
  const [status, setStatus] = useState<
    | "PENDING"
    | "CONFIRMED"
    | "WAITLISTED"
    | "CANCELED"
    | "NO_SHOW"
    | "REGULAR_PENDING"
  >(initialStatus);

  const handleStatusChange = (
    newStatus: "CONFIRMED" | "WAITLISTED" | "CANCELED"
  ) => {
    setStatus(newStatus);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "CONFIRMED":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Confirmed
          </Badge>
        );
      case "WAITLISTED":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            Waitlisted
          </Badge>
        );
      case "CANCELED":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Canceled
          </Badge>
        );
      case "NO_SHOW":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            No Show
          </Badge>
        );
      case "REGULAR_PENDING":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            Auto-Applied
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {isAutoSignup && (
          <Badge
            variant="outline"
            className="text-xs border-yellow-500/20 text-yellow-700 bg-yellow-50"
          >
            Regular
          </Badge>
        )}
        {getStatusBadge()}
      </div>
      <div className="flex justify-start sm:justify-end md:justify-start">
        <SignupActions
          signupId={signupId}
          status={status}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
