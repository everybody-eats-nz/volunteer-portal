"use client";

import { AnimatedShiftCardsWrapper } from "@/components/animated-shift-cards-wrapper";
import { toNZT, formatInNZT } from "@/lib/timezone";

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

interface ShiftsByTimeOfDayProps {
  shifts: Shift[];
  shiftIdToTypeName: Map<string, string>;
}

export function ShiftsByTimeOfDay({ shifts, shiftIdToTypeName }: ShiftsByTimeOfDayProps) {
  // Helper function to determine if a shift is AM or PM (in NZ timezone)
  const isAMShift = (shift: Shift) => {
    const nzTime = toNZT(shift.start);
    const hour = nzTime.getHours();
    return hour < 16; // Before 4pm (16:00) is considered "AM"
  };

  // Group shifts by AM/PM
  const amShifts = shifts.filter(isAMShift);
  const pmShifts = shifts.filter(shift => !isAMShift(shift));

  const hasAMShifts = amShifts.length > 0;
  const hasPMShifts = pmShifts.length > 0;

  return (
    <div className="space-y-8">
      {/* AM Shifts Section */}
      {hasAMShifts && (
        <section className="space-y-4" data-testid="admin-shifts-am-section">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-lg">
              ☀️
            </div>
            <div>
              <h3 className="text-lg font-semibold">Day Shifts</h3>
              <p className="text-sm text-muted-foreground">
                {amShifts.length} shift{amShifts.length !== 1 ? "s" : ""} available (before 4pm)
              </p>
            </div>
          </div>
          <AnimatedShiftCardsWrapper
            shifts={amShifts}
            dateString={amShifts[0]?.start ? formatInNZT(amShifts[0].start, 'yyyy-MM-dd') : ''}
            selectedLocation={amShifts[0]?.location || ''}
            shiftIdToTypeName={shiftIdToTypeName}
          />
        </section>
      )}

      {/* PM Shifts Section */}
      {hasPMShifts && (
        <section className="space-y-4" data-testid="admin-shifts-pm-section">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-lg">
              🌙
            </div>
            <div>
              <h3 className="text-lg font-semibold">Evening Shifts</h3>
              <p className="text-sm text-muted-foreground">
                {pmShifts.length} shift{pmShifts.length !== 1 ? "s" : ""} available (4pm onwards)
              </p>
            </div>
          </div>
          <AnimatedShiftCardsWrapper
            shifts={pmShifts}
            dateString={pmShifts[0]?.start ? formatInNZT(pmShifts[0].start, 'yyyy-MM-dd') : ''}
            selectedLocation={pmShifts[0]?.location || ''}
            shiftIdToTypeName={shiftIdToTypeName}
          />
        </section>
      )}
    </div>
  );
}