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
    shiftType: {
      name: string;
      description: string | null;
    };
  };
  confirmedCount: number;
  currentUserId?: string;
}

export function ShiftSignupButton({
  isFull,
  theme,
  shift,
  confirmedCount,
  currentUserId
}: ShiftSignupButtonProps) {
  return (
    <ShiftSignupDialog
      shift={shift}
      confirmedCount={confirmedCount}
      isWaitlist={isFull}
      currentUserId={currentUserId}
    >
      <Button
        data-testid="shift-signup-button"
        className={`w-full font-medium transition-all duration-200 ${
          isFull
            ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 hover:border-orange-300"
            : "bg-gradient-to-r " +
              theme.fullGradient +
              " hover:shadow-lg transform hover:scale-[1.02] text-white"
        }`}
        variant={isFull ? "outline" : "default"}
      >
        {isFull ? "🎯 Join Waitlist" : "✨ Sign Up Now"}
      </Button>
    </ShiftSignupDialog>
  );
}