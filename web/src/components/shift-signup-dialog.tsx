"use client";

import { useState, useEffect, useRef } from "react";
import { formatInNZT } from "@/lib/timezone";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoBox } from "@/components/ui/info-box";
import { MotionSpinner } from "@/components/motion-spinner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateAge } from "@/lib/utils";
import { MessageSquareDot } from "lucide-react";

interface ShiftSignupDialogProps {
  shift: {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    capacity: number;
    shiftType: {
      name: string;
      description: string | null;
    };
  };
  confirmedCount: number;
  isWaitlist?: boolean;
  currentUserId?: string; // For auto-approval eligibility check
  onSignupSuccess?: (result: { autoApproved: boolean; status: string }) => void; // Callback for successful signup
  concurrentShifts?: Array<{
    id: string;
    shiftTypeName: string;
    shiftTypeDescription: string | null;
    spotsRemaining: number;
  }>; // Optional backup shift options
  children: React.ReactNode; // The trigger button
}

function getDurationInHours(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export function ShiftSignupDialog({
  shift,
  confirmedCount,
  isWaitlist = false,
  currentUserId,
  onSignupSuccess,
  concurrentShifts = [],
  children,
}: ShiftSignupDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteField, setShowNoteField] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [selectedBackupShiftIds, setSelectedBackupShiftIds] = useState<
    string[]
  >([]);
  const [isUnderage, setIsUnderage] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true); // Default to true to avoid showing warning before check
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoApprovalEligible, setAutoApprovalEligible] = useState<{
    eligible: boolean;
    ruleName?: string;
    loading: boolean;
  }>({ eligible: false, loading: true });
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (showNoteField) {
      noteInputRef.current?.focus();
    }
  }, [showNoteField]);

  const duration = getDurationInHours(shift.start, shift.end);
  const remaining = Math.max(0, shift.capacity - confirmedCount);

  // Clear error and reset fields when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setSelectedBackupShiftIds([]);
      setShowNoteField(false);
    }
  }, [open]);

  // Check if user is underage (14 and under) and email verification status
  useEffect(() => {
    if (open && session?.user) {
      const checkUserData = async () => {
        try {
          const response = await fetch("/api/profile");
          if (response.ok) {
            const userData = await response.json();

            // Check email verification status
            setEmailVerified(userData.emailVerified ?? true);

            // Check age
            if (userData.dateOfBirth) {
              const age = calculateAge(new Date(userData.dateOfBirth));
              setIsUnderage(age <= 14);
            }
          } else {
            console.warn("Profile fetch failed:", response.status);
            setIsUnderage(false); // Default to not underage if we can't check
            setEmailVerified(true); // Default to verified to avoid blocking
          }
        } catch (error) {
          console.error("Error checking user data:", error);
          setIsUnderage(false); // Default to not underage if there's an error
          setEmailVerified(true); // Default to verified to avoid blocking
        }
      };

      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        console.warn("User data check timed out");
        setIsUnderage(false);
        setEmailVerified(true); // Default to verified to avoid blocking
      }, 3000); // 3 second timeout

      checkUserData().finally(() => {
        clearTimeout(timeoutId);
      });

      return () => clearTimeout(timeoutId);
    }
  }, [open, session]);

  // Check auto-approval eligibility when dialog opens (only for non-waitlist signups)
  useEffect(() => {
    if (open && currentUserId && !isWaitlist) {
      const checkEligibility = async () => {
        try {
          const response = await fetch(
            `/api/shifts/${shift.id}/auto-approval-check?userId=${currentUserId}`
          );
          if (response.ok) {
            const data = await response.json();
            setAutoApprovalEligible({
              eligible: data.eligible,
              ruleName: data.ruleName,
              loading: false,
            });
          } else {
            console.warn("Auto-approval check failed:", response.status);
            setAutoApprovalEligible({ eligible: false, loading: false });
          }
        } catch (error) {
          console.error("Error checking auto-approval eligibility:", error);
          setAutoApprovalEligible({ eligible: false, loading: false });
        }
      };

      // Add a small delay and timeout to prevent blocking the dialog
      const timeoutId = setTimeout(() => {
        setAutoApprovalEligible({ eligible: false, loading: false });
      }, 5000); // 5 second timeout

      checkEligibility().finally(() => {
        clearTimeout(timeoutId);
      });

      return () => clearTimeout(timeoutId);
    } else {
      // For waitlist or no user, skip eligibility check
      setAutoApprovalEligible({ eligible: false, loading: false });
    }
  }, [open, currentUserId, shift.id, isWaitlist]);

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        setVerificationResent(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to resend verification email");
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSignup = async () => {
    // Clear any previous errors
    setError(null);

    // Validate guardian name for underage users
    if (isUnderage && !guardianName.trim()) {
      setError("Please provide your guardian's name");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (isWaitlist) {
        formData.append("waitlist", "1");
      }

      // Add backup shift IDs if any selected
      if (selectedBackupShiftIds.length > 0) {
        formData.append(
          "backupShiftIds",
          JSON.stringify(selectedBackupShiftIds)
        );
      }

      // Prepare the note with guardian info if underage
      let finalNote = note.trim();
      if (isUnderage && guardianName.trim()) {
        finalNote = finalNote
          ? `${finalNote}\n\nGuardian: ${guardianName.trim()}`
          : `Guardian: ${guardianName.trim()}`;
      }

      if (finalNote) {
        formData.append("note", finalNote);
      }

      const response = await fetch(`/api/shifts/${shift.id}/signup`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();

        // Trigger confetti if auto-approved
        if (result.autoApproved) {
          // Create a celebratory confetti effect
          const colors = [
            "#10b981",
            "#3b82f6",
            "#8b5cf6",
            "#f59e0b",
            "#ef4444",
          ];

          // First burst
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: colors,
          });

          // Second burst with delay
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0, y: 0.6 },
              colors: colors,
            });
          }, 200);

          // Third burst with delay
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 1, y: 0.6 },
              colors: colors,
            });
          }, 400);
        }

        // Close dialog and refresh page data
        setOpen(false);

        // Use Next.js router refresh to update page data without full reload
        router.refresh();

        // Call success callback if provided (for additional state updates)
        if (onSignupSuccess) {
          onSignupSuccess({
            autoApproved: result.autoApproved || false,
            status: result.status || (isWaitlist ? "WAITLISTED" : "PENDING"),
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to sign up");
      }
    } catch (error) {
      console.error("Signup error:", error);
      setError("Failed to sign up. Please try again.");
    } finally {
      setIsSubmitting(false);
      // Only close dialog on success - error state will keep it open
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild data-testid="shift-signup-trigger">
        {children}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-md flex flex-col max-h-[85vh]"
        data-testid="shift-signup-dialog"
      >
        <ResponsiveDialogHeader data-testid="shift-signup-dialog-header">
          <ResponsiveDialogTitle
            className="flex items-center gap-2"
            data-testid="shift-signup-dialog-title"
          >
            {isWaitlist
              ? "🎯 Join Waitlist"
              : autoApprovalEligible.eligible && !autoApprovalEligible.loading
              ? "🚀 Instant Signup"
              : "✨ Confirm Signup"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription data-testid="shift-signup-dialog-description">
            {isWaitlist
              ? "Join the waitlist for this shift. You'll be notified if a spot becomes available."
              : autoApprovalEligible.eligible && !autoApprovalEligible.loading
              ? "You're eligible for instant approval! Confirm to sign up and get immediately confirmed for this shift."
              : "Please confirm that you want to sign up for this volunteer shift."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div
          className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0"
          data-testid="shift-signup-dialog-content-body"
        >
          {/* Email Verification Warning */}
          {!emailVerified && (
            <InfoBox
              title="Email Verification Required"
              variant="red"
              testId="email-verification-warning"
            >
              <div className="space-y-3">
                <p className="text-red-700">
                  You must verify your email address before signing up for
                  shifts. Please check your inbox for a verification email.
                </p>
                {verificationResent ? (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-green-700 text-sm">
                      ✓ Verification email sent! Please check your inbox and
                      spam folder.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleResendVerification}
                    disabled={isResendingVerification}
                    variant="outline"
                    size="sm"
                    className="w-full"
                    data-testid="resend-verification-button"
                  >
                    {isResendingVerification ? (
                      <span className="flex items-center gap-2">
                        <MotionSpinner className="w-4 h-4" />
                        Sending...
                      </span>
                    ) : (
                      "Resend Verification Email"
                    )}
                  </Button>
                )}
              </div>
            </InfoBox>
          )}

          {/* Shift Details */}
          <div
            className="rounded-lg border p-4 bg-muted/50"
            data-testid="shift-details-section"
          >
            <h3
              className="font-semibold text-lg mb-2"
              data-testid="shift-details-name"
            >
              {shift.shiftType.name}
            </h3>

            {shift.shiftType.description && (
              <p
                className="text-sm text-muted-foreground mb-3"
                data-testid="shift-details-description"
              >
                {shift.shiftType.description}
              </p>
            )}

            <div className="space-y-2 text-sm" data-testid="shift-details-info">
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-date"
              >
                <span className="font-medium">📅 Date:</span>
                <span>{formatInNZT(shift.start, "EEEE, dd MMMM yyyy")}</span>
              </div>
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-time"
              >
                <span className="font-medium">🕐 Time:</span>
                <span>
                  {formatInNZT(shift.start, "h:mm a")} -{" "}
                  {formatInNZT(shift.end, "h:mm a")}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs"
                  data-testid="shift-details-duration"
                >
                  {duration}
                </Badge>
              </div>
              {shift.location && (
                <div
                  className="flex items-center gap-2"
                  data-testid="shift-details-location"
                >
                  <span className="font-medium">📍 Location:</span>
                  <span>{shift.location}</span>
                </div>
              )}
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-capacity"
              >
                <span className="font-medium">👥 Capacity:</span>
                <span>
                  {confirmedCount}/{shift.capacity} confirmed
                  {!isWaitlist && remaining > 0 && (
                    <span className="text-green-600 ml-1">
                      ({remaining} spots left)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Note Field */}
          {!showNoteField ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowNoteField(true);
              }}
              className="w-full"
              data-testid="show-note-button"
            >
              <MessageSquareDot />
              Add a message
            </Button>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                ref={noteInputRef}
                id="note"
                placeholder="Add any notes for the shift coordinator..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="shift-signup-note"
              />
            </div>
          )}

          {/* Guardian Field for Underage Users */}
          {isUnderage && (
            <div className="space-y-2">
              <Label htmlFor="guardian" className="flex items-center gap-2">
                Guardian Name
                <span className="text-red-500">*</span>
                <span className="text-xs text-muted-foreground">
                  (required for volunteers 14 and under)
                </span>
              </Label>
              <Input
                id="guardian"
                placeholder="Enter your parent/guardian's full name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                required
                data-testid="shift-signup-guardian"
              />
            </div>
          )}

          {/* Backup Shift Options */}
          {concurrentShifts.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div>
                <Label className="font-medium">
                  Flexible with shift changes? (optional)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  If we need to move you, which other shifts at the same time
                  would you be OK with?
                </p>
              </div>
              <div className="space-y-2">
                {concurrentShifts.map((concurrentShift) => (
                  <div
                    key={concurrentShift.id}
                    className="flex items-start space-x-3"
                  >
                    <Checkbox
                      id={`backup-${concurrentShift.id}`}
                      checked={selectedBackupShiftIds.includes(
                        concurrentShift.id
                      )}
                      onCheckedChange={(checked) => {
                        setSelectedBackupShiftIds((prev) =>
                          checked
                            ? [...prev, concurrentShift.id]
                            : prev.filter((id) => id !== concurrentShift.id)
                        );
                      }}
                      data-testid={`backup-shift-${concurrentShift.id}`}
                    />
                    <div className="space-y-0.5 leading-none flex-1">
                      <Label
                        htmlFor={`backup-${concurrentShift.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {concurrentShift.shiftTypeName}
                      </Label>
                      {concurrentShift.shiftTypeDescription && (
                        <p className="text-xs text-muted-foreground">
                          {concurrentShift.shiftTypeDescription}
                        </p>
                      )}
                      {concurrentShift.spotsRemaining > 0 ? (
                        <p className="text-xs text-green-600">
                          {concurrentShift.spotsRemaining} spot
                          {concurrentShift.spotsRemaining !== 1 ? "s" : ""}{" "}
                          available
                        </p>
                      ) : (
                        <p className="text-xs text-orange-600">
                          Full - Waitlist available
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <InfoBox title="Error" variant="red" testId="signup-error">
              <p className="text-red-700">{error}</p>
            </InfoBox>
          )}

          {/* Approval Process Info */}
          {autoApprovalEligible.loading ? (
            <InfoBox
              title="Checking eligibility..."
              testId="approval-process-loading"
            >
              <p>Checking if you qualify for instant approval...</p>
            </InfoBox>
          ) : autoApprovalEligible.eligible && !isWaitlist ? (
            <InfoBox
              title={`🎉 Instant Approval Available!`}
              variant="green"
              testId="auto-approval-info"
            >
              <p>
                <strong>Great news!</strong> You&apos;ll be automatically
                approved for this shift based on your volunteer history.
              </p>
            </InfoBox>
          ) : (
            <InfoBox
              title={isWaitlist ? "Waitlist Process" : "Approval Required"}
              testId="approval-process-info"
            >
              <p>
                {isWaitlist
                  ? "You'll be added to the waitlist and notified by email if a spot becomes available and you're approved."
                  : "Your signup will be reviewed by an administrator. You'll receive an email confirmation if you're approved for this shift."}
              </p>
            </InfoBox>
          )}
        </div>

        <ResponsiveDialogFooter
          className="flex gap-2"
          data-testid="shift-signup-dialog-footer"
        >
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            data-testid="shift-signup-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSignup}
            disabled={isSubmitting || !emailVerified}
            className="min-w-[120px]"
            data-testid="shift-signup-confirm-button"
          >
            {isSubmitting ? (
              <span
                className="flex items-center gap-2"
                data-testid="shift-signup-loading-text"
              >
                <MotionSpinner className="w-4 h-4" />
                {isWaitlist ? "Joining..." : "Signing up..."}
              </span>
            ) : isWaitlist ? (
              "🎯 Join Waitlist"
            ) : autoApprovalEligible.eligible &&
              !autoApprovalEligible.loading ? (
              "🚀 Sign Up (Auto-Approved)"
            ) : (
              "✨ Confirm Signup"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
