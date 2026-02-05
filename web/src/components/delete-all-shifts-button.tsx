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
        className="h-11 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800/40 border-red-300 dark:border-red-700"
        data-testid="delete-all-shifts-button"
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete All
      </Button>
    </DeleteAllShiftsDialog>
  );
}
