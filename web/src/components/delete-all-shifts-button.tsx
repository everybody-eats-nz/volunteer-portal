"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DeleteAllShiftsDialog } from "@/components/delete-all-shifts-dialog";

interface DeleteAllShiftsButtonProps {
  shiftCount: number;
  volunteerCount: number;
  shiftTypes: string[];
  date: string;
  dateString: string;
  location: string;
}

export function DeleteAllShiftsButton({
  shiftCount,
  volunteerCount,
  shiftTypes,
  date,
  dateString,
  location,
}: DeleteAllShiftsButtonProps) {
  const handleDelete = async () => {
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

    // Preserve current date and location filters when redirecting
    const params = new URLSearchParams({
      bulkDeleted: result.deletedCount.toString(),
      date: dateString,
      location,
    });
    window.location.href = `/admin/shifts?${params.toString()}`;
  };

  return (
    <DeleteAllShiftsDialog
      shiftCount={shiftCount}
      volunteerCount={volunteerCount}
      shiftTypes={shiftTypes}
      date={date}
      location={location}
      onDelete={handleDelete}
    >
      <Button
        variant="outline"
        size="sm"
        className="h-11 border-red-200 bg-background text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        data-testid="delete-all-shifts-button"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete All
      </Button>
    </DeleteAllShiftsDialog>
  );
}
