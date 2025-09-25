"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface SignupActionsProps {
  signupId: string;
  status: "PENDING" | "CONFIRMED" | "WAITLISTED" | "CANCELED" | "NO_SHOW" | "REGULAR_PENDING";
  onStatusChange?: (newStatus: "CONFIRMED" | "WAITLISTED" | "CANCELED") => void;
}

export function SignupActions({ signupId, status, onStatusChange }: SignupActionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: ""
  });
  // Validate signupId
  if (!signupId || signupId.trim() === '') {
    console.error('Invalid signupId provided to SignupActions:', signupId);
    return (
      <div className="text-red-600 text-sm">
        Invalid signup ID
      </div>
    );
  }

  const handleSignupAction = async (action: "approve" | "reject") => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      console.log(`Processing ${action} for signup ID: ${signupId}`);
      
      const response = await fetch(`/api/admin/signups/${signupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Successfully ${action}ed signup:`, result);
        
        // Update UI optimistically
        const newStatus = result.status as "CONFIRMED" | "WAITLISTED" | "CANCELED";
        onStatusChange?.(newStatus);
        
        // Show success toast
        toast.success(result.message || `Signup ${action}ed successfully`);
      } else {
        const error = await response.json();
        console.error(`Failed to ${action} signup:`, error);
        
        let errorMessage = error.error || "Failed to process signup";
        if (error.debug) {
          errorMessage += `\n\nDebug info: ${error.debug}`;
        }
        if (error.signupId) {
          errorMessage += `\nSignup ID: ${error.signupId}`;
        }
        
        setErrorDialog({
          open: true,
          title: `Failed to ${action} signup`,
          message: errorMessage
        });
      }
    } catch (error) {
      console.error("Signup action error:", error);
      setErrorDialog({
        open: true,
        title: "Network Error",
        message: `Network error while processing signup: ${error}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (status !== "PENDING" && status !== "REGULAR_PENDING") {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleSignupAction("approve")}
          disabled={isProcessing}
          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          {isProcessing ? "..." : "✓ Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleSignupAction("reject")}
          disabled={isProcessing}
          className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {isProcessing ? "..." : "✕ Reject"}
        </Button>
      </div>

      {/* Error Dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialog(prev => ({ ...prev, open: false }))}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
