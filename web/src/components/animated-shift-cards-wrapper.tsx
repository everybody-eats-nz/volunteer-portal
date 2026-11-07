"use client";

import { AnimatePresence } from "motion/react";
import { AnimatedShiftCards } from "./animated-shift-cards";

interface Shift {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  notes: string | null;
  /** Off for hand-picked special events. Missing means on. */
  autoApprovalEnabled?: boolean;
  placeholders: Array<{
    id: string;
    name: string;
    notes: string | null;
  }>;
  shiftType: {
    id: string;
    name: string;
  };
  signups: Array<{
    id: string;
    status: string;
    note: string | null;
    /** Waitlisted by an admin, and whether the volunteer has kept the place. */
    waitlistAddedByAdminAt?: Date | null;
    waitlistConfirmedAt?: Date | null;
    backupForShiftIds: string[];
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      volunteerGrade: string | null;
      profilePhotoUrl: string | null;
      dateOfBirth: Date | null;
      adminNotes: Array<{
        id: string;
        content: string;
        createdAt: Date;
        creator: {
          name: string | null;
          firstName: string | null;
          lastName: string | null;
        };
      }>;
      customLabels: Array<{
        label: {
          id: string;
          name: string;
          color: string;
          icon: string | null;
        };
        note?: string | null;
        assignedAt?: Date;
        assignedBy?: {
          name: string | null;
          firstName: string | null;
          lastName: string | null;
        } | null;
      }>;
    };
  }>;
}

interface AnimatedShiftCardsWrapperProps {
  shifts: Shift[];
  dateString: string;
  selectedLocation: string;
  shiftIdToTypeName: Map<string, string>;
}

export function AnimatedShiftCardsWrapper({
  shifts,
  dateString,
  selectedLocation,
  shiftIdToTypeName
}: AnimatedShiftCardsWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      <AnimatedShiftCards
        key={`${dateString}-${selectedLocation}`}
        shifts={shifts}
        shiftIdToTypeName={shiftIdToTypeName}
      />
    </AnimatePresence>
  );
}