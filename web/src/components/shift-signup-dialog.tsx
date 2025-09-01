"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
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
  children,
}: ShiftSignupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoApprovalEligible, setAutoApprovalEligible] = useState<{
    eligible: boolean;
    ruleName?: string;
    loading: boolean;
  }>({ eligible: false, loading: true });

  const duration = getDurationInHours(shift.start, shift.end);
  const remaining = Math.max(0, shift.capacity - confirmedCount);

  // Check auto-approval eligibility when dialog opens (only for non-waitlist signups)
  useEffect(() => {
    if (open && currentUserId && !isWaitlist) {
      const checkEligibility = async () => {
        try {
          const response = await fetch(`/api/shifts/${shift.id}/auto-approval-check?userId=${currentUserId}`);
          if (response.ok) {
            const data = await response.json();
            setAutoApprovalEligible({ 
              eligible: data.eligible, 
              ruleName: data.ruleName,
              loading: false 
            });
          } else {
            setAutoApprovalEligible({ eligible: false, loading: false });
          }
        } catch (error) {
          console.error('Error checking auto-approval eligibility:', error);
          setAutoApprovalEligible({ eligible: false, loading: false });
        }
      };
      
      checkEligibility();
    } else {
      // For waitlist or no user, skip eligibility check
      setAutoApprovalEligible({ eligible: false, loading: false });
    }
  }, [open, currentUserId, shift.id, isWaitlist]);

  const handleSignup = async () => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (isWaitlist) {
        formData.append("waitlist", "1");
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
          const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
          
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
            status: result.status || (isWaitlist ? "WAITLISTED" : "PENDING")
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || "Failed to sign up");
      }
    } catch (error) {
      console.error("Signup error:", error);
      alert("Failed to sign up. Please try again.");
    } finally {
      setIsSubmitting(false);
      setOpen(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild data-testid="shift-signup-trigger">{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-md" data-testid="shift-signup-dialog">
        <ResponsiveDialogHeader data-testid="shift-signup-dialog-header">
          <ResponsiveDialogTitle className="flex items-center gap-2" data-testid="shift-signup-dialog-title">
            {isWaitlist ? "🎯 Join Waitlist" : autoApprovalEligible.eligible && !autoApprovalEligible.loading ? "🚀 Instant Signup" : "✨ Confirm Signup"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription data-testid="shift-signup-dialog-description">
            {isWaitlist
              ? "Join the waitlist for this shift. You'll be notified if a spot becomes available."
              : autoApprovalEligible.eligible && !autoApprovalEligible.loading
              ? "You're eligible for instant approval! Confirm to sign up and get immediately confirmed for this shift."
              : "Please confirm that you want to sign up for this volunteer shift."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4" data-testid="shift-signup-dialog-content-body">
          {/* Shift Details */}
          <div className="rounded-lg border p-4 bg-muted/50" data-testid="shift-details-section">
            <h3 className="font-semibold text-lg mb-2" data-testid="shift-details-name">
              {shift.shiftType.name}
            </h3>

            {shift.shiftType.description && (
              <p className="text-sm text-muted-foreground mb-3" data-testid="shift-details-description">
                {shift.shiftType.description}
              </p>
            )}

            <div className="space-y-2 text-sm" data-testid="shift-details-info">
              <div className="flex items-center gap-2" data-testid="shift-details-date">
                <span className="font-medium">📅 Date:</span>
                <span>{format(shift.start, "EEEE, dd MMMM yyyy")}</span>
              </div>
              <div className="flex items-center gap-2" data-testid="shift-details-time">
                <span className="font-medium">🕐 Time:</span>
                <span>
                  {format(shift.start, "h:mm a")} -{" "}
                  {format(shift.end, "h:mm a")}
                </span>
                <Badge variant="outline" className="text-xs" data-testid="shift-details-duration">
                  {duration}
                </Badge>
              </div>
              {shift.location && (
                <div className="flex items-center gap-2" data-testid="shift-details-location">
                  <span className="font-medium">📍 Location:</span>
                  <span>{shift.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2" data-testid="shift-details-capacity">
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
                <strong>Great news!</strong> You&apos;ll be automatically approved for this shift based on your volunteer history.
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

        <ResponsiveDialogFooter className="flex gap-2" data-testid="shift-signup-dialog-footer">
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
            disabled={isSubmitting}
            className="min-w-[120px]"
            data-testid="shift-signup-confirm-button"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2" data-testid="shift-signup-loading-text">
                <MotionSpinner className="w-4 h-4" />
                {isWaitlist ? "Joining..." : "Signing up..."}
              </span>
            ) : isWaitlist ? (
              "🎯 Join Waitlist"
            ) : autoApprovalEligible.eligible && !autoApprovalEligible.loading ? (
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
