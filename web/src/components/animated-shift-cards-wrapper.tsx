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
  shiftType: {
    id: string;
    name: string;
  };
  signups: Array<{
    id: string;
    status: string;
    note: string | null;
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
      }>;
    };
  }>;
  groupBookings: Array<{
    signups: Array<{
      status: string;
    }>;
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