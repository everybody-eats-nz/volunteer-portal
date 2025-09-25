"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PauseIcon, PlayIcon, EditIcon, CalendarIcon } from "lucide-react";
import { format } from "date-fns";

type RegularVolunteer = {
  id: string;
  userId: string;
  location: string;
  frequency: string;
  availableDays: string[];
  isActive: boolean;
  isPausedByUser: boolean;
  pausedUntil: Date | null;
  notes: string | null;
  volunteerNotes: string | null;
  shiftType: {
    id: string;
    name: string;
  };
};

const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function RegularScheduleManager({
  regularVolunteer,
}: {
  regularVolunteer: RegularVolunteer;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    frequency: regularVolunteer.frequency,
    availableDays: regularVolunteer.availableDays,
    volunteerNotes: regularVolunteer.volunteerNotes || "",
  });

  // Pause form state
  const [pauseForm, setPauseForm] = useState({
    pausedUntil: "",
    reason: "",
  });

  const handleEdit = async () => {
    if (editForm.availableDays.length === 0) {
      toast.error("Please select at least one available day");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/profile/regular-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frequency: editForm.frequency,
          availableDays: editForm.availableDays,
          volunteerNotes: editForm.volunteerNotes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update schedule");
      }

      toast.success("Regular schedule updated successfully");
      setEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update schedule"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (resume = false) => {
    setLoading(true);
    try {
      const response = await fetch("/api/profile/regular-schedule/pause", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPaused: !resume,
          pausedUntil: resume ? null : pauseForm.pausedUntil || null,
          reason: resume ? "Resumed by volunteer" : pauseForm.reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || `Failed to ${resume ? "resume" : "pause"} schedule`
        );
      }

      toast.success(
        `Regular schedule ${resume ? "resumed" : "paused"} successfully`
      );
      setPauseDialogOpen(false);
      setPauseForm({ pausedUntil: "", reason: "" });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${resume ? "resume" : "pause"} schedule`
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setEditForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EditIcon className="h-5 w-5" />
            Manage Schedule
          </CardTitle>
          <CardDescription>
            Update your regular volunteer schedule settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setEditDialogOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <EditIcon className="h-4 w-4" />
              Edit Schedule
            </Button>

            {regularVolunteer.isPausedByUser ? (
              <Button
                onClick={() => handlePause(true)}
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <PlayIcon className="h-4 w-4" />
                {loading ? "Resuming..." : "Resume Schedule"}
              </Button>
            ) : (
              <Button
                onClick={() => setPauseDialogOpen(true)}
                variant="outline"
                className="flex items-center gap-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
              >
                <PauseIcon className="h-4 w-4" />
                Pause Schedule
              </Button>
            )}
          </div>

          {regularVolunteer.isPausedByUser && regularVolunteer.pausedUntil && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  Paused until{" "}
                  {format(regularVolunteer.pausedUntil, "MMMM d, yyyy")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Regular Schedule</DialogTitle>
            <DialogDescription>
              Update your regular volunteer schedule preferences. Changes will
              apply to future shifts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Frequency */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={editForm.frequency}
                onValueChange={(value) =>
                  setEditForm((prev) => ({ ...prev, frequency: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select frequency..." />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Available Days */}
            <div className="space-y-2">
              <Label>Available Days</Label>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                {DAYS.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={
                      editForm.availableDays.includes(day)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => toggleDay(day)}
                    className="w-full"
                  >
                    {day.slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Volunteer Notes */}
            <div className="space-y-2">
              <Label htmlFor="volunteerNotes">Your Notes (Optional)</Label>
              <Textarea
                id="volunteerNotes"
                rows={3}
                placeholder="Any preferences or notes about your availability..."
                value={editForm.volunteerNotes}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    volunteerNotes: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause Dialog */}
      <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Regular Schedule</DialogTitle>
            <DialogDescription>
              Temporarily pause your regular volunteer schedule. Any pending
              auto-signups will be canceled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pausedUntil">Resume Date (Optional)</Label>
              <Input
                type="date"
                id="pausedUntil"
                value={pauseForm.pausedUntil}
                onChange={(e) =>
                  setPauseForm((prev) => ({
                    ...prev,
                    pausedUntil: e.target.value,
                  }))
                }
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to pause indefinitely. You can resume anytime.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                rows={2}
                placeholder="e.g., vacation, personal break, temporarily unavailable..."
                value={pauseForm.reason}
                onChange={(e) =>
                  setPauseForm((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPauseDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handlePause(false)}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {loading ? "Pausing..." : "Pause Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
