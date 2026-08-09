"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Clock, UserMinus, AlertTriangle, ArrowRightLeft, CalendarOff, UserCheck, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatInNZT } from "@/lib/timezone";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";

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
  backupShiftIds?: string[]; // Optional: shifts the volunteer nominated as backups - highlighted, not enforced
}

type MoveTargetShift = {
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
  // True when the volunteer nominated this shift as a backup at signup time
  isPreferred: boolean;
};

/** How much room is left on a move target, phrased for the option's meta line. */
function describeCapacity(shift: MoveTargetShift) {
  const spotsLeft = shift.capacity - shift.confirmedCount;
  if (spotsLeft > 0) {
    return `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} available`;
  }
  if (spotsLeft === 0) {
    return "No spots left";
  }
  return `${-spotsLeft} over capacity`;
}

/**
 * Options for the "move volunteer" target picker. Every shift on the day stays
 * selectable - backup preferences are sorted to the top and badged, and full
 * shifts are badged so the admin knows they are going over capacity, but nothing
 * is hidden. Hiding full shifts made moves one-way, since the shift a volunteer
 * came from is often full once someone else takes their spot.
 */
function MoveTargetOptions({ shifts }: { shifts: MoveTargetShift[] }) {
  return (
    <>
      {shifts.map((shift) => {
        const isFull = shift.confirmedCount >= shift.capacity;
        return (
          <SelectItem
            key={shift.id}
            value={shift.id}
            textValue={shift.shiftType.name}
            data-testid={`move-target-option-${shift.id}`}
          >
            <span className="flex min-w-0 flex-col! items-start! gap-0.5">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{shift.shiftType.name}</span>
                {shift.isPreferred && (
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200"
                  >
                    <ArrowRightLeft aria-hidden="true" />
                    Backup choice
                  </Badge>
                )}
                {isFull && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-200"
                  >
                    <AlertTriangle aria-hidden="true" />
                    Full
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatInNZT(new Date(shift.start), "h:mm a")} - {formatInNZT(new Date(shift.end), "h:mm a")} • {describeCapacity(shift)}
              </span>
            </span>
          </SelectItem>
        );
      })}
    </>
  );
}

/** Warns the admin that the shift they picked is already at or over capacity. */
function MoveOverCapacityNotice({
  shift,
  volunteerName,
}: {
  shift: MoveTargetShift;
  volunteerName?: string;
}) {
  return (
    <p
      className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300"
      data-testid="move-over-capacity-notice"
    >
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {shift.shiftType.name} is already full. Moving {volunteerName || "this volunteer"} here takes it over capacity.
      </span>
    </p>
  );
}

type MoveVolunteerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tid: (suffix: string) => string;
  currentShift: NonNullable<VolunteerActionsProps["currentShift"]>;
  volunteerName?: string;
  shifts: MoveTargetShift[];
  selectedShiftId: string;
  onSelectShift: (shiftId: string) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
  loading: boolean;
  fieldIdPrefix: string;
};

/**
 * The "move volunteer to another shift" dialog, shared by the confirmed and
 * pending action rows. One name in the title, the context in the description,
 * and a single decision in the body - it has to stay readable on a phone, which
 * is where admins run service.
 */
function MoveVolunteerDialog({
  open,
  onOpenChange,
  tid,
  currentShift,
  volunteerName,
  shifts,
  selectedShiftId,
  onSelectShift,
  notes,
  onNotesChange,
  onConfirm,
  loading,
  fieldIdPrefix,
}: MoveVolunteerDialogProps) {
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId);
  const selectedIsFull = selectedShift
    ? selectedShift.confirmedCount >= selectedShift.capacity
    : false;
  const hasTargets = shifts.length > 0;
  const shiftDay = formatInNZT(currentShift.start, "EEEE d MMMM");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800/60"
              disabled={loading}
              title="Move to different shift"
              data-testid={tid("move-button")}
            >
              {loading ? (
                <Clock className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-3 w-3" />
              )}
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Move to different shift</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md" data-testid={tid("move-dialog")}>
        <DialogHeader className="text-left">
          <DialogTitle data-testid={tid("move-dialog-title")}>
            Move {volunteerName || "volunteer"}
          </DialogTitle>
          <DialogDescription data-testid={tid("move-dialog-description")}>
            Currently on {currentShift.shiftType.name}, {shiftDay}.
            {hasTargets && " Pick another shift on the same day."}
          </DialogDescription>
        </DialogHeader>

        {hasTargets ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${fieldIdPrefix}-target-shift`}>Move to</Label>
              <Select value={selectedShiftId} onValueChange={onSelectShift}>
                <SelectTrigger
                  id={`${fieldIdPrefix}-target-shift`}
                  className="w-full"
                  data-testid={tid("move-shift-select")}
                >
                  <SelectValue placeholder="Choose a shift" />
                </SelectTrigger>
                <SelectContent className="w-(--radix-select-trigger-width)">
                  <MoveTargetOptions shifts={shifts} />
                </SelectContent>
              </Select>
              {selectedIsFull && selectedShift && (
                <MoveOverCapacityNotice
                  shift={selectedShift}
                  volunteerName={volunteerName}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldIdPrefix}-movement-notes`}>
                Notes (optional)
              </Label>
              <Textarea
                id={`${fieldIdPrefix}-movement-notes`}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Add any notes about this movement..."
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg border border-dashed p-6 text-center"
            data-testid="move-no-targets"
          >
            <CalendarOff
              className="mx-auto h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-medium">No other shifts that day</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentShift.location} has nothing else scheduled on {shiftDay}.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid={tid("move-dialog-cancel")}
          >
            {hasTargets ? "Cancel" : "Close"}
          </Button>
          {hasTargets && (
            <Button
              onClick={onConfirm}
              disabled={!selectedShiftId || loading}
              data-testid={tid("move-dialog-confirm")}
            >
              {loading ? <Clock className="h-3 w-3 animate-spin mr-2" /> : null}
              Move Volunteer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VolunteerActions({ signupId, currentStatus, onUpdate, testIdPrefix, currentShift, volunteerName, backupShiftIds }: VolunteerActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [availableShifts, setAvailableShifts] = useState<MoveTargetShift[]>([]);
  const [selectedTargetShift, setSelectedTargetShift] = useState<string>("");
  const [movementNotes, setMovementNotes] = useState("");
  const [sendEmailOnReject, setSendEmailOnReject] = useState(true); // Default to checked
  const router = useRouter();

  const fetchAvailableShifts = useCallback(async () => {
    if (!currentShift) return;

    try {
      const shiftDate = formatInNZT(currentShift.start, "yyyy-MM-dd");
      const response = await fetch(`/api/admin/shifts/available?date=${shiftDate}&location=${currentShift.location}`);
      if (response.ok) {
        const data: Omit<MoveTargetShift, "isPreferred">[] = await response.json();

        // Every other shift on the day stays selectable, full or not. Backup
        // preferences and free spots only affect ordering - restricting the list
        // made moves one-way, since the shift a volunteer came from is often
        // full or not among their nominated backups.
        const targets: MoveTargetShift[] = data
          .filter((shift) => shift.id !== currentShift.id)
          .map((shift) => ({
            ...shift,
            isPreferred: backupShiftIds?.includes(shift.id) ?? false,
          }));

        // Preferences first, then shifts with room, then keep start-time order
        targets.sort((a, b) => {
          if (a.isPreferred !== b.isPreferred) {
            return Number(b.isPreferred) - Number(a.isPreferred);
          }
          const aHasRoom = a.confirmedCount < a.capacity;
          const bHasRoom = b.confirmedCount < b.capacity;
          return Number(bHasRoom) - Number(aHasRoom);
        });

        setAvailableShifts(targets);
      }
    } catch (error) {
      console.error("Error fetching available shifts:", error);
    }
  }, [currentShift, backupShiftIds]);

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

  const handleAction = async (action: "approve" | "reject" | "cancel" | "confirm" | "mark_present" | "mark_absent", options?: { skipNotification?: boolean }) => {
    setLoading(action);
    setDialogOpen(null);

    try {
      const requestBody: { action: string; sendEmail?: boolean; skipNotification?: boolean } = { action };

      // Include sendEmail parameter for reject action
      if (action === "reject" && sendEmailOnReject) {
        requestBody.sendEmail = true;
      }

      // Skip notification for past shift cancellations
      if (options?.skipNotification) {
        requestBody.skipNotification = true;
      }

      const response = await fetch(`/api/admin/signups/${signupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} signup`);
      }

      router.refresh();
      if (onUpdate) onUpdate();

      // Reset sendEmailOnReject after successful rejection
      if (action === "reject") {
        setSendEmailOnReject(true); // Reset to default (checked)
      }
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
      case "cancel_past":
        return {
          title: "Cancel Volunteer Shift",
          description: "Are you sure you want to cancel this volunteer's shift record? Since this shift has already ended, no notification will be sent.",
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
          description: "Are you sure you want to reject this volunteer's signup? This action cannot be undone. You can optionally send them a notification email.",
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

  const tid = (suffix: string) =>
    testIdPrefix ? `${testIdPrefix}-${suffix}` : `volunteer-${suffix}-${signupId}`;

  const handleMoveDialogChange = (open: boolean) => {
    setDialogOpen(open ? "move" : null);
    if (!open) {
      setSelectedTargetShift("");
      setMovementNotes("");
    }
  };

  const moveDialog = currentShift ? (
    <MoveVolunteerDialog
      open={dialogOpen === "move"}
      onOpenChange={handleMoveDialogChange}
      tid={tid}
      currentShift={currentShift}
      volunteerName={volunteerName}
      shifts={availableShifts}
      selectedShiftId={selectedTargetShift}
      onSelectShift={setSelectedTargetShift}
      notes={movementNotes}
      onNotesChange={setMovementNotes}
      onConfirm={handleVolunteerMove}
      loading={loading === "move"}
      fieldIdPrefix={`move-${signupId}`}
    />
  ) : null;

  if (currentStatus === "CONFIRMED") {
    const cancelDialogContent = getDialogContent("cancel");
    const cancelPastDialogContent = getDialogContent("cancel_past");
    const markAbsentDialogContent = getDialogContent("mark_absent");

    if (shiftCompleted) {
      // Past shift - show attendance tracking
      return (
        <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-confirmed-past-actions` : `volunteer-actions-${signupId}-confirmed-past`}>
          {/* Mark Absent Button */}
          <Dialog open={dialogOpen === "mark_absent"} onOpenChange={(open) => setDialogOpen(open ? "mark_absent" : null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs bg-red-100 dark:bg-red-900/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/60"
                    disabled={loading === "mark_absent"}
                    data-testid={testIdPrefix ? `${testIdPrefix}-mark-absent-button` : `volunteer-mark-absent-${signupId}`}
                  >
                    {loading === "mark_absent" ? (
                      <Clock className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserX className="h-3 w-3" />
                    )}
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Mark as no show</TooltipContent>
            </Tooltip>
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

          {/* Cancel Button for past shifts */}
          <Dialog open={dialogOpen === "cancel"} onOpenChange={(open) => setDialogOpen(open ? "cancel" : null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/60"
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
              </TooltipTrigger>
              <TooltipContent>Cancel this shift</TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-[425px]" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog` : `volunteer-cancel-dialog-${signupId}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-title` : `volunteer-cancel-dialog-title-${signupId}`}>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {cancelPastDialogContent.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-600" data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-description` : `volunteer-cancel-dialog-description-${signupId}`}>
                  {cancelPastDialogContent.description}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(null)}
                  disabled={loading === "cancel"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-cancel` : `volunteer-cancel-dialog-cancel-${signupId}`}
                >
                  Go Back
                </Button>
                <Button
                  variant={cancelPastDialogContent.variant}
                  onClick={() => handleAction("cancel", { skipNotification: true })}
                  disabled={loading === "cancel"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-cancel-dialog-confirm` : `volunteer-cancel-dialog-confirm-${signupId}`}
                >
                  {loading === "cancel" ? (
                    <Clock className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  {cancelPastDialogContent.actionText}
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
        {/* Move Button */}
        {!shiftCompleted && moveDialog}

        {/* Cancel Button - only for future shifts */}
        {!shiftCompleted && (
          <Dialog open={dialogOpen === "cancel"} onOpenChange={(open) => setDialogOpen(open ? "cancel" : null)}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs bg-red-100 dark:bg-red-900/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/60"
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
              </TooltipTrigger>
              <TooltipContent>Cancel this shift</TooltipContent>
            </Tooltip>
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
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <EmailPreviewDialog
                    emailType="volunteerCancellation"
                    triggerLabel="Preview Email"
                    triggerVariant="outline"
                  />
                </div>
                <div className="flex gap-2">
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
                </div>
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
        <Dialog open={dialogOpen === "confirm"} onOpenChange={(open) => setDialogOpen(open ? "confirm" : null)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs bg-green-100 dark:bg-green-900/60 border-green-300 dark:border-green-700 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/60"
                  disabled={loading === "confirm"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-confirm-button` : `volunteer-confirm-${signupId}`}
                >
                  {loading === "confirm" ? (
                    <Clock className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Confirm this volunteer (allows over-capacity)</TooltipContent>
          </Tooltip>
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
        {/* Mark Present Button - allow reverting no-show status */}
        <Dialog open={dialogOpen === "mark_present"} onOpenChange={(open) => setDialogOpen(open ? "mark_present" : null)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs bg-green-100 dark:bg-green-900/60 border-green-300 dark:border-green-700 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/60"
                  disabled={loading === "mark_present"}
                  data-testid={testIdPrefix ? `${testIdPrefix}-mark-present-button` : `volunteer-mark-present-${signupId}`}
                >
                  {loading === "mark_present" ? (
                    <Clock className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserCheck className="h-3 w-3" />
                  )}
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Mark as present</TooltipContent>
          </Tooltip>
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
    return null; // Status badge shown next to name, no actions needed
  }

  // For PENDING or REGULAR_PENDING status, show action buttons
  const rejectDialogContent = getDialogContent("reject");

  return (
    <div className="flex gap-1" data-testid={testIdPrefix ? `${testIdPrefix}-pending-actions` : `volunteer-actions-${signupId}-pending`}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs bg-green-100 dark:bg-green-900/60 border-green-300 dark:border-green-700 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/60"
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
        </TooltipTrigger>
        <TooltipContent>Approve this volunteer</TooltipContent>
      </Tooltip>

      {/* Move Button for Pending */}
      {moveDialog}

      <Dialog open={dialogOpen === "reject"} onOpenChange={(open) => setDialogOpen(open ? "reject" : null)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs bg-red-100 dark:bg-red-900/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/60"
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
          </TooltipTrigger>
          <TooltipContent>Reject this signup</TooltipContent>
        </Tooltip>
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
          <div className="py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-email-on-reject"
                checked={sendEmailOnReject}
                onCheckedChange={(checked) => setSendEmailOnReject(checked === true)}
                data-testid={testIdPrefix ? `${testIdPrefix}-reject-send-email-checkbox` : `volunteer-reject-send-email-checkbox-${signupId}`}
              />
              <label
                htmlFor="send-email-on-reject"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Send notification email to volunteer
              </label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <EmailPreviewDialog
                emailType="volunteerNotNeeded"
                triggerLabel="Preview Email"
                triggerVariant="outline"
              />
            </div>
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}