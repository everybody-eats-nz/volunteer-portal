"use client";

import { useState } from "react";
import { CalendarX2, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAllShiftsDialog } from "@/components/delete-all-shifts-dialog";
import { DeleteShiftsDateRangeDialog } from "@/components/delete-shifts-date-range-dialog";
import { parseISOInNZT } from "@/lib/timezone";

interface DeleteShiftsMenuProps {
  shiftCount: number;
  volunteerCount: number;
  shiftTypes: string[];
  date: string;
  dateString: string;
  location: string;
}

export function DeleteShiftsMenu({
  shiftCount,
  volunteerCount,
  shiftTypes,
  date,
  dateString,
  location,
}: DeleteShiftsMenuProps) {
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);

  const redirectAfterDelete = (deletedCount: number) => {
    // Preserve current date and location filters when redirecting
    const params = new URLSearchParams({
      bulkDeleted: deletedCount.toString(),
      date: dateString,
      location,
    });
    window.location.href = `/admin/shifts?${params.toString()}`;
  };

  const handleDeleteDay = async () => {
    const response = await fetch(
      `/api/admin/shifts/by-date?date=${dateString}&location=${encodeURIComponent(location)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete shifts");
    }

    const result = await response.json();
    redirectAfterDelete(result.deletedCount);
  };

  const handleDeleteRange = async (startDate: string, endDate: string) => {
    const response = await fetch(
      `/api/admin/shifts/by-date-range?startDate=${startDate}&endDate=${endDate}&location=${encodeURIComponent(location)}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to delete shifts");
    }

    const result = await response.json();
    redirectAfterDelete(result.deletedCount);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-11 border-red-200 bg-background text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            data-testid="delete-shifts-menu-button"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setDayDialogOpen(true)}
            disabled={shiftCount === 0}
            className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
            data-testid="delete-all-shifts-menu-item"
          >
            <Trash2 className="h-4 w-4" />
            All shifts for this day
            {shiftCount === 0 && (
              <span className="text-xs text-muted-foreground">(none)</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setRangeDialogOpen(true)}
            className="text-red-600 focus:text-red-700 dark:text-red-400 dark:focus:text-red-300"
            data-testid="delete-date-range-menu-item"
          >
            <CalendarX2 className="h-4 w-4" />
            Shifts in a date range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteAllShiftsDialog
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        shiftCount={shiftCount}
        volunteerCount={volunteerCount}
        shiftTypes={shiftTypes}
        date={date}
        location={location}
        onDelete={handleDeleteDay}
      />
      <DeleteShiftsDateRangeDialog
        open={rangeDialogOpen}
        onOpenChange={setRangeDialogOpen}
        location={location}
        defaultMonth={parseISOInNZT(dateString)}
        onDelete={handleDeleteRange}
      />
    </>
  );
}
