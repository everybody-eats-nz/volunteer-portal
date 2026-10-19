"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { getProfileEditHref } from "@/lib/profile-completion";
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
  WAITLIST_EXPLAINER,
  WAITLIST_IF_FULL_HINT,
  WAITLIST_IF_FULL_LABEL,
  waitlistSizeSentence,
} from "@/lib/waitlist";
import {
  MessageSquareDot,
  User,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle2,
  Hourglass,
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
  variant?: "forest" | "green" | "red" | "amber";
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
    amber:
      "border-orange-200 bg-orange-50 dark:border-orange-900/60 dark:bg-orange-950/30",
  }[variant];
  const iconColor = {
    forest: "text-forest-500 dark:text-cream-50/60",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    amber: "text-orange-600 dark:text-orange-400",
  }[variant];
  const titleColor = {
    forest: "text-forest-700 dark:text-cream-50",
    green: "text-green-900 dark:text-green-100",
    red: "text-red-900 dark:text-red-100",
    amber: "text-orange-900 dark:text-orange-100",
  }[variant];
  const contentColor = {
    forest: "text-forest-700/70 dark:text-cream-50/65",
    green: "text-green-700 dark:text-green-300",
    red: "text-red-700 dark:text-red-300",
    amber: "text-orange-800 dark:text-orange-200",
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
  /**
   * How many volunteers are already waitlisted. Shown before someone commits
   * to standby so they can judge the odds instead of joining blind.
   */
  waitlistCount?: number;
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
  confirmedCount: initialConfirmedCount,
  isWaitlist: initialIsWaitlist = false,
  waitlistCount: initialWaitlistCount = 0,
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
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  /** Required profile fields the server says are still missing. */
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>(
    []
  );
  // Asked for signups that need approval: if the shift fills first, wait for
  // a place or not? Unticked by default so nobody is waitlisted unasked.
  const [waitlistIfFull, setWaitlistIfFull] = useState(false);
  // The shift filled between opening the dialog and confirming. The server's
  // fresh counts replace the page's stale ones so the waitlist view reads true.
  const [filledWhileOpen, setFilledWhileOpen] = useState<{
    confirmedCount: number;
    capacity: number;
    waitlistCount: number;
  } | null>(null);
  const isWaitlist = initialIsWaitlist || filledWhileOpen !== null;
  const confirmedCount =
    filledWhileOpen?.confirmedCount ?? initialConfirmedCount;
  const waitlistCount = filledWhileOpen?.waitlistCount ?? initialWaitlistCount;
  const capacity = filledWhileOpen?.capacity ?? shift.capacity;
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showNoteField) {
      noteInputRef.current?.focus();
    }
  }, [showNoteField]);

  // The "just filled up" notice renders at the top of the body; bring it into
  // view, since the volunteer is usually scrolled down at the confirm button.
  useEffect(() => {
    if (filledWhileOpen) bodyRef.current?.scrollTo({ top: 0 });
  }, [filledWhileOpen]);

  // Underage (14 and under) and email verification checks. Until the profile
  // loads (or if it can't), assume an adult with a verified address so the
  // dialog never blocks on the check.
  const { data: profile } = useSWR<{
    emailVerified?: boolean;
    dateOfBirth?: string | null;
  }>(open && session?.user ? "/api/profile" : null, {
    onError: (error) => console.error("Error checking user data:", error),
  });
  const emailVerified = profile?.emailVerified ?? true;
  const isUnderage = profile?.dateOfBirth
    ? calculateAge(new Date(profile.dateOfBirth)) <= GUARDIAN_REQUIRED_AGE
    : false;

  // Auto-approval eligibility, for non-waitlist signups only. A check slower
  // than 5s stops holding the dialog up and it carries on as a normal signup.
  const eligibilityKey =
    open && currentUserId && !initialIsWaitlist
      ? `/api/shifts/${shift.id}/auto-approval-check?userId=${currentUserId}`
      : null;
  const [slowEligibilityKey, setSlowEligibilityKey] = useState<string | null>(
    null
  );
  const { data: eligibility, isLoading: eligibilityLoading } = useSWR<{
    eligible: boolean;
    ruleName?: string;
  }>(eligibilityKey, {
    loadingTimeout: 5000,
    onLoadingSlow: (key) => setSlowEligibilityKey(key),
    onError: (error) =>
      console.error("Error checking auto-approval eligibility:", error),
  });
  const autoApprovalEligible = {
    eligible: eligibility?.eligible ?? false,
    ruleName: eligibility?.ruleName,
    loading: eligibilityLoading && slowEligibilityKey !== eligibilityKey,
  };

  const duration = getDurationInHours(shift.start, shift.end);
  const remaining = Math.max(0, capacity - confirmedCount);
  const autoApproved =
    autoApprovalEligible.eligible && !autoApprovalEligible.loading;
  // Only when an admin will review it. An instant signup can't be overtaken.
  const askWaitlistIfFull =
    !isWaitlist && !autoApprovalEligible.loading && !autoApproved;

  // Every open starts with a clean slate.
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setError(null);
      setProfileIncomplete(false);
      setSelectedBackupShiftIds([]);
      setShowNoteField(false);
      setWaitlistIfFull(false);
      setFilledWhileOpen(null);
    }
    setOpen(nextOpen);
  };

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
      if (askWaitlistIfFull) {
        formData.append("waitlistIfFull", waitlistIfFull ? "1" : "0");
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
        if (errorData.waitlistAvailable === true) {
          // Never waitlist them silently: switch to the waitlist view and let
          // them decide.
          const liveCapacity =
            typeof errorData.capacity === "number"
              ? errorData.capacity
              : shift.capacity;
          setFilledWhileOpen({
            capacity: liveCapacity,
            confirmedCount:
              typeof errorData.confirmedCount === "number"
                ? errorData.confirmedCount
                : liveCapacity,
            waitlistCount:
              typeof errorData.waitlistCount === "number"
                ? errorData.waitlistCount
                : initialWaitlistCount,
          });
        } else if (errorData.error === "Profile incomplete") {
          setProfileIncomplete(true);
          setMissingProfileFields(
            Array.isArray(errorData.missingFields)
              ? errorData.missingFields.filter(
                  (field: unknown): field is string => typeof field === "string"
                )
              : []
          );
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
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild data-testid="shift-signup-trigger">
        {children}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-md flex flex-col max-h-[85vh]"
        data-testid="shift-signup-dialog"
      >
        <ResponsiveDialogHeader data-testid="shift-signup-dialog-header">
          <p className="eyebrow text-forest-500/80 dark:text-cream-50/60">
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
              ? `This shift is full. ${waitlistSizeSentence(waitlistCount)}`
              : autoApproved
              ? "You're eligible for instant approval! Confirm to sign up and get immediately confirmed for this shift."
              : "Please confirm that you want to sign up for this volunteer shift."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div
          ref={bodyRef}
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

          {filledWhileOpen && (
            <DialogPanel
              variant="amber"
              icon={<Hourglass className="h-4 w-4" />}
              title="This shift just filled up"
              testId="shift-filled-notice"
            >
              <span role="alert">
                The last place went while you were signing up. You can join the
                waitlist instead, or cancel to look for another shift.
              </span>
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
                className="mt-1 text-sm whitespace-pre-line text-forest-700/65 dark:text-cream-50/60"
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
                  {confirmedCount}/{capacity} confirmed
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

          {/* Profile Incomplete — name the missing fields and link straight
              to the edit section that holds the first one. */}
          {profileIncomplete && (
            <DialogPanel
              variant="red"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Complete your profile to sign up"
              testId="profile-incomplete-warning"
            >
              <div className="space-y-3">
                {missingProfileFields.length > 0 ? (
                  <>
                    <p>Your profile still needs:</p>
                    <ul
                      className="list-disc space-y-1 pl-5"
                      data-testid="missing-profile-fields"
                    >
                      {missingProfileFields.map((field) => (
                        <li key={field}>{field}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>
                    Your profile is missing some required information. Finish
                    filling it in and we&apos;ll get you signed up.
                  </p>
                )}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="complete-profile-button"
                >
                  <Link href={getProfileEditHref(missingProfileFields)}>
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
              {isWaitlist ? (
                <span data-testid="waitlist-process-note">
                  {WAITLIST_EXPLAINER}
                </span>
              ) : (
                "Your signup will be reviewed by an administrator. You'll receive an email confirmation if you're approved for this shift."
              )}
            </DialogPanel>
          )}

          {/* If the shift fills before an admin gets to them: wait or not? */}
          {askWaitlistIfFull && (
            <label htmlFor="waitlist-if-full" className={optionRow}>
              <Checkbox
                id="waitlist-if-full"
                checked={waitlistIfFull}
                onCheckedChange={(checked) => setWaitlistIfFull(checked === true)}
                className="mt-0.5"
                aria-describedby="waitlist-if-full-hint"
                data-testid="waitlist-if-full-checkbox"
              />
              <div className="flex-1 space-y-1">
                <span className="text-sm font-medium text-forest-700 dark:text-cream-50">
                  {WAITLIST_IF_FULL_LABEL}
                </span>
                <p
                  id="waitlist-if-full-hint"
                  className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60"
                >
                  {WAITLIST_IF_FULL_HINT}
                </p>
              </div>
            </label>
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
