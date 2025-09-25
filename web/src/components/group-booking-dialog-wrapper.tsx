"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { GroupBookingDialog } from "@/components/group-booking-dialog";

interface Shift {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  shiftType: {
    name: string;
    description: string | null;
  };
  signups: Array<{
    status: string;
  }>;
}

interface GroupBookingDialogWrapperProps {
  shifts: Shift[];
  date: string;
  location: string;
  testid?: string;
  currentUserEmail?: string;
}

export function GroupBookingDialogWrapper({
  shifts,
  date,
  location,
  testid,
  currentUserEmail,
}: GroupBookingDialogWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="mr-4"
        onClick={() => setIsOpen(true)}
        data-testid={testid}
      >
        <Users className="h-4 w-4 mr-2" />
        Group Booking
      </Button>

      <GroupBookingDialog
        shifts={shifts}
        date={date}
        location={location}
        open={isOpen}
        onOpenChange={setIsOpen}
        currentUserEmail={currentUserEmail}
      />
    </>
  );
}
