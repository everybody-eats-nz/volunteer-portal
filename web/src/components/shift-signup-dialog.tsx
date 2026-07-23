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
import { MotionSpinner } from "@/components/motion-spinner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateAge, GUARDIAN_REQUIRED_AGE } from "@/lib/utils";
import { getShiftDescription } from "@/lib/shift-description";
import {
  MessageSquareDot,
  User,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";

/* Option rows + soft brand panels — shared language with the marketing-styled
   forms (see friend-privacy-settings.tsx). */
const optionRow =
  "flex cursor-pointer items-start gap-3 rounded-2xl border border-forest-500/15 p-3 transition-colors hover:bg-forest-500/5 has-data-[state=checked]:border-forest-500/40 has-data-[state=checked]:bg-forest-500/5 dark:border-cream-50/15 dark:hover:bg-cream-50/5 dark:has-data-[state=checked]:border-cream-50/40 dark:has-data-[state=checked]:bg-cream-50/5";

function DialogPanel({
  variant = "forest",
  icon,
  title,
  children,
  testId,
}: {
  variant?: "forest" | "green" | "red";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  const container = {
    forest:
      "border-forest-500/15 bg-forest-500/5 dark:border-cream-50/15 dark:bg-cream-50/5",
    green:
      "border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30",
    red: "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40",
  }[variant];
  const iconColor = {
    forest: "text-forest-500 dark:text-cream-50/60",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
  }[variant];
  const titleColor = {
    forest: "text-forest-700 dark:text-cream-50",
    green: "text-green-900 dark:text-green-100",
    red: "text-red-900 dark:text-red-100",
  }[variant];
  const contentColor = {
    forest: "text-forest-700/70 dark:text-cream-50/65",
    green: "text-green-700 dark:text-green-300",
    red: "text-red-700 dark:text-red-300",
  }[variant];
  return (
    <div className={`rounded-2xl border p-4 ${container}`} data-testid={testId}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${iconColor}`}>{icon}</span>
        <div className="min-w-0 text-sm">
          <p className={`font-medium ${titleColor}`}>{title}</p>
          <div className={`mt-1 leading-relaxed ${contentColor}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

interface ShiftSignupDialogProps {
  shift: {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    capacity: number;
    notes?: string | null;
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
  const turnstileRef = useRef<TurnstileHandle>(null);
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
  const [profileIncomplete, setProfileIncomplete] = useState(false);
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
  const autoApproved =
    autoApprovalEligible.eligible && !autoApprovalEligible.loading;

  // Clear error and reset fields when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setProfileIncomplete(false);
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
              setIsUnderage(age <= GUARDIAN_REQUIRED_AGE);
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
      const turnstileToken = await turnstileRef.current?.getToken();
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
        },
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
        if (errorData.error === "Profile incomplete") {
          setProfileIncomplete(true);
          setError(null);
        } else {
          setError(errorData.error || "Failed to sign up");
        }
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
          <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            {isWaitlist
              ? "Shift is full"
              : autoApproved
              ? "You're pre-approved"
              : "Kia ora — one quick step"}
          </p>
          <ResponsiveDialogTitle
            className="display display-medium mt-2 text-2xl tracking-tight text-forest-700 dark:text-cream-50"
            data-testid="shift-signup-dialog-title"
          >
            {isWaitlist
              ? "Join Waitlist"
              : autoApproved
              ? "Instant Signup"
              : "Confirm Signup"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription
            className="text-forest-700/65 dark:text-cream-50/60"
            data-testid="shift-signup-dialog-description"
          >
            {isWaitlist
              ? "Join the waitlist for this shift. You'll be notified if a spot becomes available."
              : autoApproved
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
            <DialogPanel
              variant="red"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Email Verification Required"
              testId="email-verification-warning"
            >
              <div className="space-y-3">
                <p>
                  You must verify your email address before signing up for
                  shifts. Please check your inbox for a verification email.
                </p>
                <Turnstile ref={turnstileRef} />
                {verificationResent ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-800/50 dark:bg-green-950/30">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Verification email sent! Please check your inbox and spam
                      folder.
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
            </DialogPanel>
          )}

          {/* Shift Details */}
          <div
            className="rounded-2xl border border-forest-500/15 bg-forest-500/5 p-4 dark:border-cream-50/15 dark:bg-cream-50/5"
            data-testid="shift-details-section"
          >
            <h3
              className="display text-lg tracking-tight text-forest-700 dark:text-cream-50"
              data-testid="shift-details-name"
            >
              {shift.shiftType.name}
            </h3>

            {getShiftDescription(shift.notes, shift.shiftType.description) && (
              <p
                className="mt-1 text-sm text-forest-700/65 dark:text-cream-50/60"
                data-testid="shift-details-description"
              >
                {getShiftDescription(shift.notes, shift.shiftType.description)}
              </p>
            )}

            <div
              className="mt-3 space-y-2 text-sm text-forest-700/80 dark:text-cream-50/75"
              data-testid="shift-details-info"
            >
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-date"
              >
                <Calendar className="h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/55" />
                <span>{formatInNZT(shift.start, "EEEE, dd MMMM yyyy")}</span>
              </div>
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-time"
              >
                <Clock className="h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/55" />
                <span className="tabular-nums">
                  {formatInNZT(shift.start, "h:mm a")} -{" "}
                  {formatInNZT(shift.end, "h:mm a")}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs border-forest-500/20 text-forest-700/80 dark:border-cream-50/15 dark:text-cream-50/75"
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
                  <MapPin className="h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/55" />
                  <span>{shift.location}</span>
                </div>
              )}
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-capacity"
              >
                <Users className="h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/55" />
                <span className="tabular-nums">
                  {confirmedCount}/{shift.capacity} confirmed
                  {!isWaitlist && remaining > 0 && (
                    <span className="ml-1 font-medium text-forest-600 dark:text-forest-300">
                      ({remaining} {remaining === 1 ? "spot" : "spots"} left)
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
              <Label
                htmlFor="note"
                className="text-sm font-medium text-forest-700/80 dark:text-cream-50/80"
              >
                Note (optional)
              </Label>
              <Textarea
                ref={noteInputRef}
                id="note"
                placeholder="Add any notes for the shift coordinator..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="resize-none rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15"
                data-testid="shift-signup-note"
              />
            </div>
          )}

          {/* Guardian Field for Underage Users */}
          {isUnderage && (
            <div className="space-y-2">
              <Label
                htmlFor="guardian"
                className="flex items-center gap-2 text-sm font-medium text-forest-700/80 dark:text-cream-50/80"
              >
                Guardian Name
                <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-forest-700/55 dark:text-cream-50/55">
                  (required for volunteers 14 and under)
                </span>
              </Label>
              <Input
                id="guardian"
                placeholder="Enter your parent/guardian's full name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                required
                className="h-11 rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15"
                data-testid="shift-signup-guardian"
              />
            </div>
          )}

          {/* Backup Shift Options */}
          {concurrentShifts.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-forest-500/15 bg-forest-500/5 p-4 dark:border-cream-50/15 dark:bg-cream-50/5">
              <div>
                <Label className="text-sm font-medium text-forest-700 dark:text-cream-50">
                  Flexible with shift changes? (optional)
                </Label>
                <p className="mt-1 text-sm text-forest-700/65 dark:text-cream-50/60">
                  If we need to move you, which other shifts at the same time
                  would you be OK with?
                </p>
              </div>
              <div className="space-y-2">
                {concurrentShifts.map((concurrentShift) => (
                  <label
                    key={concurrentShift.id}
                    htmlFor={`backup-${concurrentShift.id}`}
                    className={optionRow}
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
                      className="mt-0.5"
                      data-testid={`backup-shift-${concurrentShift.id}`}
                    />
                    <div className="flex-1 space-y-0.5 leading-none">
                      <span className="text-sm font-medium text-forest-700 dark:text-cream-50">
                        {concurrentShift.shiftTypeName}
                      </span>
                      {concurrentShift.shiftTypeDescription && (
                        <p className="text-xs text-forest-700/60 dark:text-cream-50/55">
                          {concurrentShift.shiftTypeDescription}
                        </p>
                      )}
                      {concurrentShift.spotsRemaining > 0 ? (
                        <p className="text-xs font-medium text-forest-600 dark:text-forest-300">
                          {concurrentShift.spotsRemaining} spot
                          {concurrentShift.spotsRemaining !== 1 ? "s" : ""}{" "}
                          available
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                          Full — waitlist available
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Profile Incomplete — actionable CTA to /profile/edit */}
          {profileIncomplete && (
            <DialogPanel
              variant="red"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Complete your profile to sign up"
              testId="profile-incomplete-warning"
            >
              <div className="space-y-3">
                <p>
                  Your profile is missing some required information. Finish
                  filling it in and we&apos;ll get you signed up.
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="complete-profile-button"
                >
                  <Link href="/profile/edit">
                    <User className="h-4 w-4" />
                    Complete Profile
                  </Link>
                </Button>
              </div>
            </DialogPanel>
          )}

          {/* Error Display */}
          {error && (
            <DialogPanel
              variant="red"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Something went wrong"
              testId="signup-error"
            >
              {error}
            </DialogPanel>
          )}

          {/* Approval Process Info */}
          {autoApprovalEligible.loading ? (
            <DialogPanel
              variant="forest"
              icon={<Info className="h-4 w-4" />}
              title="Checking eligibility…"
              testId="approval-process-loading"
            >
              Checking if you qualify for instant approval…
            </DialogPanel>
          ) : autoApproved && !isWaitlist ? (
            <DialogPanel
              variant="green"
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Instant approval available!"
              testId="auto-approval-info"
            >
              <strong className="font-semibold">Ka pai!</strong> You&apos;ll be
              automatically approved for this shift based on your volunteer
              history.
            </DialogPanel>
          ) : (
            <DialogPanel
              variant="forest"
              icon={<Info className="h-4 w-4" />}
              title={isWaitlist ? "Waitlist process" : "Approval required"}
              testId="approval-process-info"
            >
              {isWaitlist
                ? "You'll be added to the waitlist and notified by email if a spot becomes available and you're approved."
                : "Your signup will be reviewed by an administrator. You'll receive an email confirmation if you're approved for this shift."}
            </DialogPanel>
          )}
        </div>

        <ResponsiveDialogFooter
          className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
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
            className="min-w-[140px]"
            data-testid="shift-signup-confirm-button"
          >
            {isSubmitting ? (
              <span
                className="flex items-center gap-2"
                data-testid="shift-signup-loading-text"
              >
                <MotionSpinner className="w-4 h-4" />
                {isWaitlist ? "Joining…" : "Signing up…"}
              </span>
            ) : isWaitlist ? (
              "Join Waitlist"
            ) : autoApproved ? (
              "Sign Up (Auto-Approved)"
            ) : (
              "Confirm Signup"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
