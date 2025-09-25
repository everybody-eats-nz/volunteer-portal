"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, UserMinus, AlertTriangle, ArrowRightLeft, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { isShiftCompleted } from "@/lib/shift-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VolunteerActionsProps {
  signupId: string;
  currentStatus: string;
  onUpdate?: () => void;
  testIdPrefix?: string;
  currentShift?: {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    shiftType: {
      name: string;
    };
  };
  volunteerName?: string;
}

export function VolunteerActions({ signupId, currentStatus, onUpdate, testIdPrefix, currentShift, volunteerName }: VolunteerActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [availableShifts, setAvailableShifts] = useState<{
    id: string;
    start: string;
    end: string;
    location: string | null;
    capacity: number;
    confirmedCount: number;
    shiftType: {
      id: string;
      name: string;
    };
  }[]>([]);
  const [selectedTargetShift, setSelectedTargetShift] = useState<string>("");
  const [movementNotes, setMovementNotes] = useState("");
  const router = useRouter();

  const fetchAvailableShifts = useCallback(async () => {
    if (!currentShift) return;

    try {
      const shiftDate = format(currentShift.start, "yyyy-MM-dd");
      const response = await fetch(`/api/admin/shifts/available?date=${shiftDate}&location=${currentShift.location}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out the current shift and show all available shifts
        const filtered = data.filter((shift: typeof availableShifts[0]) => shift.id !== currentShift.id);
        setAvailableShifts(filtered);
      }
    } catch (error) {
      console.error("Error fetching available shifts:", error);
    }
  }, [currentShift]);

  // Fetch available shifts for movement
  useEffect(() => {
    if (dialogOpen === "move" && currentShift) {
      fetchAvailableShifts();
    }
  }, [dialogOpen, currentShift, fetchAvailableShifts]);

  const handleVolunteerMove = async () => {
    if (!selectedTargetShift) return;

    setLoading("move");
    try {
      const response = await fetch("/api/admin/volunteer-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupId,
          targetShiftId: selectedTargetShift,
          movementNotes: movementNotes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to move volunteer");
      }

      setDialogOpen(null);
      setSelectedTargetShift("");
      setMovementNotes("");
      router.refresh();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error moving volunteer:", error);
      alert(`Failed to move volunteer. ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleAction = async (action: "approve" | "reject" | "cancel" | "confirm" | "mark_present" | "mark_absent") => {
    setLoading(action);
    setDialogOpen(null);
    
    try {
      const response = await fetch(`/api/admin/signups/${signupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} signup`);
      }

      router.refresh();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error(`Error ${action}ing signup:`, error);
      alert(`Failed to ${action} signup. Please try again.`);
    } finally {
      setLoading(null);
    }
  };

  const getDialogContent = (action: string) => {
    switch (action) {
      case "cancel":
        return {
          title: "Cancel Volunteer Shift",
          description: "Are you sure you want to cancel this volunteer's shift? They will be notified by email and the slot will become available for others.",
          actionText: "Cancel Shift",
          variant: "destructive" as const,
        };
      case "confirm":
        return {
          title: "Confirm Waitlisted Volunteer", 
          description: "Are you sure you want to confirm this waitlisted volunteer? This will allow going over the shift capacity.",
          actionText: "Confirm Volunteer",
          variant: "default" as const,
        };
      case "reject":
        return {
          title: "Reject Volunteer Signup",
          description: "Are you sure you want to reject this volunteer's signup? This action cannot be undone.",
          actionText: "Reject Signup",
          variant: "destructive" as const,
        };
      case "mark_absent":
        return {
          title: "Mark Volunteer as No Show",
          description: "Mark this volunteer as a no-show for this completed shift. This will change their status to 'No Show'.",
          actionText: "Mark No Show",
          variant: "destructive" as const,
        };
      case "mark_present":
        return {
          title: "Confirm Volunteer Attendance",
          description: "Confirm that this volunteer attended this completed shift. This will change their status back to 'Confirmed'.",
          actionText: "Mark Present",
          variant: "default" as const,
        };
      default:
        return {
          title: "Confirm Action",
          description: "Are you sure you want to proceed?",
          actionText: "Confirm",
          variant: "default" as const,
        };
    }
  };

  // Helper to check if shift has ended (use end time, not start time)
  const shiftCompleted = currentShift ? isShiftCompleted(currentShift.end) : false;

  if (currentStatus === "CONFIRMED") {
    const cancelDialogContent = getDialogContent("cancel");
    const markAbsentDialogContent = getDialogContent("mark_absent");
    
    if (shiftCompleted) {
      // Past shift - show attendance tracking
      return (
        <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-confirmed-past-actions` : `volunteer-actions-${signupId}-confirmed-past`}>
          <div className="flex items-center text-xs text-green-600 font-medium" data-testid={testIdPrefix ? `${testIdPrefix}-confirmed-status` : `volunteer-status-${signupId}-confirmed`}>
            <Check className="h-3 w-3 mr-1" />
            Attended
          </div>
          
          {/* Mark Absent Button */}
          <Dialog open={dialogOpen === "mark_absent"} onOpenChange={(open) => setDialogOpen(open ? "mark_absent" : null)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                disabled={loading === "mark_absent"}
                title="Mark as no show"
                data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-button` : `volunteer-mark-absent-${signupId}`}
              >
                {loading === "mark_absent" ? (
                  <Clock className="h-3 w-3 animate-spin" />
                ) : (
                  <UserX className="h-3 w-3" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-dialog` : `volunteer-mark-absent-dialog-${signupId}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-dialog-title` : `volunteer-mark-absent-dialog-title-${signupId}`}>
                  <UserX className="h-5 w-5 text-red-500" />
                  {markAbsentDialogContent.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-dialog-description` : `volunteer-mark-absent-dialog-description-${signupId}`}>
                  {markAbsentDialogContent.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(null)}
                  disabled={loading === "mark_absent"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-dialog-cancel` : `volunteer-mark-absent-dialog-cancel-${signupId}`}
                >
                  Cancel
                </Button>
                <Button
                  variant={markAbsentDialogContent.variant}
                  onClick={() => handleAction("mark_absent")}
                  disabled={loading === "mark_absent"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-dialog-confirm` : `volunteer-mark-absent-dialog-confirm-${signupId}`}
                >
                  {loading === "mark_absent" ? (
                    <Clock className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  {markAbsentDialogContent.actionText}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // Current/future shift - show normal actions
    return (
      <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-confirmed-actions` : `volunteer-actions-${signupId}-confirmed`}>
        <div className="flex items-center text-xs text-green-600 font-medium" data-testid={testIdPrefix ? `${testIdPrefix}-confirmed-status` : `volunteer-status-${signupId}-confirmed`}>
          <Check className="h-3 w-3 mr-1" />
          Confirmed
        </div>

        {/* Move Button */}
        {currentShift && !shiftCompleted && (
          <Dialog open={dialogOpen === "move"} onOpenChange={(open) => setDialogOpen(open ? "move" : null)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                disabled={loading === "move"}
                title="Move to different shift"
                data-testid={testIdPrefix ? `${testIdPrefix}-move-button` : `volunteer-move-${signupId}`}
              >
                {loading === "move" ? (
                  <Clock className="h-3 w-3 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-3 w-3" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-testid={testIdPrefix ? `${testIdPrefix}-move-dialog` : `volunteer-move-dialog-${signupId}`}>
              <DialogHeader>
                <DialogTitle data-testid={testIdPrefix ? `${testIdPrefix}-move-dialog-title` : `volunteer-move-dialog-title-${signupId}`}>
                  Move {volunteerName || 'Volunteer'} to Different Shift
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-move-dialog-description` : `volunteer-move-dialog-description-${signupId}`}>
                  Move this volunteer from {currentShift.shiftType.name} to a different shift on the same day.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="targetShift">Select Target Shift</Label>
                  <Select value={selectedTargetShift} onValueChange={setSelectedTargetShift}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a shift..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableShifts.map(shift => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.shiftType.name} • {format(new Date(shift.start), "h:mm a")} - {format(new Date(shift.end), "h:mm a")} • {shift.capacity - shift.confirmedCount} spots available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="movementNotes">Movement Notes (optional)</Label>
                  <Textarea
                    id="movementNotes"
                    value={movementNotes}
                    onChange={(e) => setMovementNotes(e.target.value)}
                    placeholder="Add any notes about this movement..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(null)}
                  disabled={loading === "move"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-move-dialog-cancel` : `volunteer-move-dialog-cancel-${signupId}`}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleVolunteerMove}
                  disabled={!selectedTargetShift || loading === "move"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-move-dialog-confirm` : `volunteer-move-dialog-confirm-${signupId}`}
                >
                  {loading === "move" ? (
                    <Clock className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  Move Volunteer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Cancel Button - only for future shifts */}
        {!shiftCompleted && (
          <Dialog open={dialogOpen === "cancel"} onOpenChange={(open) => setDialogOpen(open ? "cancel" : null)}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                disabled={loading === "cancel"}
                title="Cancel this shift"
                data-testid={testIdPrefix ? `${testIdPrefix}-cancel-button` : `volunteer-cancel-${signupId}`}
              >
                {loading === "cancel" ? (
                  <Clock className="h-3 w-3 animate-spin" />
                ) : (
                  <UserMinus className="h-3 w-3" />
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog` : `volunteer-cancel-dialog-${signupId}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-title` : `volunteer-cancel-dialog-title-${signupId}`}>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  {cancelDialogContent.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-description` : `volunteer-cancel-dialog-description-${signupId}`}>
                  {cancelDialogContent.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(null)}
                  disabled={loading === "cancel"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-cancel` : `volunteer-cancel-dialog-cancel-${signupId}`}
                >
                  Cancel
                </Button>
                <Button
                  variant={cancelDialogContent.variant}
                  onClick={() => handleAction("cancel")}
                  disabled={loading === "cancel"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-confirm` : `volunteer-cancel-dialog-confirm-${signupId}`}
                >
                  {loading === "cancel" ? (
                    <Clock className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  {cancelDialogContent.actionText}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  if (currentStatus === "WAITLISTED") {
    const dialogContent = getDialogContent("confirm");
    
    return (
      <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-waitlisted-actions` : `volunteer-actions-${signupId}-waitlisted`}>
        <div className="flex items-center text-xs text-purple-600 font-medium" data-testid={testIdPrefix ? `${testIdPrefix}-waitlisted-status` : `volunteer-status-${signupId}-waitlisted`}>
          <Clock className="h-3 w-3 mr-1" />
          Waitlisted
        </div>
        <Dialog open={dialogOpen === "confirm"} onOpenChange={(open) => setDialogOpen(open ? "confirm" : null)}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              disabled={loading === "confirm"}
              title="Confirm this volunteer (allows over-capacity)"
              data-testid={testIdPrefix ? `${testIdPrefix}-confirm-button` : `volunteer-confirm-${signupId}`}
            >
              {loading === "confirm" ? (
                <Clock className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-confirm-dialog` : `volunteer-confirm-dialog-${signupId}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-confirm-dialog-title` : `volunteer-confirm-dialog-title-${signupId}`}>
                <Check className="h-5 w-5 text-green-500" />
                {dialogContent.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-confirm-dialog-description` : `volunteer-confirm-dialog-description-${signupId}`}>
                {dialogContent.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(null)}
                disabled={loading === "confirm"}
                data-testid={testIdPrefix ? `${testIdPrefix}-confirm-dialog-cancel` : `volunteer-confirm-dialog-cancel-${signupId}`}
              >
                Cancel
              </Button>
              <Button
                variant={dialogContent.variant}
                onClick={() => handleAction("confirm")}
                disabled={loading === "confirm"}
                data-testid={testIdPrefix ? `${testIdPrefix}-confirm-dialog-confirm` : `volunteer-confirm-dialog-confirm-${signupId}`}
              >
                {loading === "confirm" ? (
                  <Clock className="h-3 w-3 animate-spin mr-2" />
                ) : null}
                {dialogContent.actionText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (currentStatus === "NO_SHOW") {
    const markPresentDialogContent = getDialogContent("mark_present");
    
    return (
      <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-no-show-actions` : `volunteer-actions-${signupId}-no-show`}>
        <div className="flex items-center text-xs text-red-600 font-medium" data-testid={testIdPrefix ? `${testIdPrefix}-no-show-status` : `volunteer-status-${signupId}-no-show`}>
          <UserX className="h-3 w-3 mr-1" />
          No Show
        </div>
        
        {/* Mark Present Button - allow reverting no-show status */}
        <Dialog open={dialogOpen === "mark_present"} onOpenChange={(open) => setDialogOpen(open ? "mark_present" : null)}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              disabled={loading === "mark_present"}
              title="Mark as present"
              data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-button` : `volunteer-mark-present-${signupId}`}
            >
              {loading === "mark_present" ? (
                <Clock className="h-3 w-3 animate-spin" />
              ) : (
                <UserCheck className="h-3 w-3" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-dialog` : `volunteer-mark-present-dialog-${signupId}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-dialog-title` : `volunteer-mark-present-dialog-title-${signupId}`}>
                <UserCheck className="h-5 w-5 text-green-500" />
                {markPresentDialogContent.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-dialog-description` : `volunteer-mark-present-dialog-description-${signupId}`}>
                {markPresentDialogContent.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(null)}
                disabled={loading === "mark_present"}
                data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-dialog-cancel` : `volunteer-mark-present-dialog-cancel-${signupId}`}
              >
                Cancel
              </Button>
              <Button
                variant={markPresentDialogContent.variant}
                onClick={() => handleAction("mark_present")}
                disabled={loading === "mark_present"}
                data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-dialog-confirm` : `volunteer-mark-present-dialog-confirm-${signupId}`}
              >
                {loading === "mark_present" ? (
                  <Clock className="h-3 w-3 animate-spin mr-2" />
                ) : null}
                {markPresentDialogContent.actionText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (currentStatus === "CANCELED") {
    return (
      <div className="flex items-center text-xs text-red-600 font-medium" data-testid={testIdPrefix ? `${testIdPrefix}-canceled-status` : `volunteer-status-${signupId}-canceled`}>
        <X className="h-3 w-3 mr-1" />
        Canceled
      </div>
    );
  }

  // For PENDING or REGULAR_PENDING status, show action buttons
  const rejectDialogContent = getDialogContent("reject");
  
  return (
    <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-pending-actions` : `volunteer-actions-${signupId}-pending`}>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        onClick={() => handleAction("approve")}
        disabled={loading === "approve"}
        data-testid={testIdPrefix ? `${testIdPrefix}-approve-button` : `volunteer-approve-${signupId}`}
      >
        {loading === "approve" ? (
          <Clock className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
      </Button>
      
      <Dialog open={dialogOpen === "reject"} onOpenChange={(open) => setDialogOpen(open ? "reject" : null)}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            disabled={loading === "reject"}
            data-testid={testIdPrefix ? `${testIdPrefix}-reject-button` : `volunteer-reject-${signupId}`}
          >
            {loading === "reject" ? (
              <Clock className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-reject-dialog` : `volunteer-reject-dialog-${signupId}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-reject-dialog-title` : `volunteer-reject-dialog-title-${signupId}`}>
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {rejectDialogContent.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-reject-dialog-description` : `volunteer-reject-dialog-description-${signupId}`}>
              {rejectDialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(null)}
              disabled={loading === "reject"}
              data-testid={testIdPrefix ? `${testIdPrefix}-reject-dialog-cancel` : `volunteer-reject-dialog-cancel-${signupId}`}
            >
              Cancel
            </Button>
            <Button
              variant={rejectDialogContent.variant}
              onClick={() => handleAction("reject")}
              disabled={loading === "reject"}
              data-testid={testIdPrefix ? `${testIdPrefix}-reject-dialog-confirm` : `volunteer-reject-dialog-confirm-${signupId}`}
            >
              {loading === "reject" ? (
                <Clock className="h-3 w-3 animate-spin mr-2" />
              ) : null}
              {rejectDialogContent.actionText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}