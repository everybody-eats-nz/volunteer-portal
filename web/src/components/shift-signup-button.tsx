"use client";

import { Button } from "@/components/ui/button";
import { ShiftSignupDialog } from "@/components/shift-signup-dialog";

interface ShiftSignupButtonProps {
  isFull: boolean;
  theme: {
    fullGradient: string;
  };
  shift: {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    capacity: number;
    notes?: string | null;
    shiftType: {
      name: string;
      description: string | null;
    };
  };
  confirmedCount: number;
  /** Volunteers already waitlisted — surfaced in the dialog when the shift is full. */
  waitlistCount?: number;
  currentUserId?: string;
  concurrentShifts?: Array<{
    id: string;
    shiftTypeName: string;
    shiftTypeDescription: string | null;
    spotsRemaining: number;
  }>;
}

export function ShiftSignupButton({
  isFull,
  shift,
  confirmedCount,
  waitlistCount = 0,
  currentUserId,
  concurrentShifts,
}: ShiftSignupButtonProps) {
  return (
    <ShiftSignupDialog
      shift={shift}
      confirmedCount={confirmedCount}
      isWaitlist={isFull}
      waitlistCount={waitlistCount}
      currentUserId={currentUserId}
      concurrentShifts={concurrentShifts}
    >
      <Button
        data-testid="shift-signup-button"
        className={`w-full font-medium ${
          isFull
            ? "border border-sun-300/70 bg-sun-100/70 text-forest-700 hover:bg-sun-200 hover:border-sun-300 dark:border-sun-200/30 dark:bg-sun-200/15 dark:text-cream-50 dark:hover:bg-sun-200/25"
            : ""
        }`}
        variant={isFull ? "outline" : "default"}
      >
        {isFull ? "Join Waitlist" : "Sign Up Now"}
      </Button>
    </ShiftSignupDialog>
  );
}