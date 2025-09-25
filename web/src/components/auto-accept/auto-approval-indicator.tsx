"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, Clock } from "lucide-react";

interface AutoApprovalIndicatorProps {
  shiftId: string;
  onSignupClick?: () => void;
  isSignedUp?: boolean;
}

interface EligibilityResult {
  eligible: boolean;
  ruleName?: string;
  reason?: string;
  alreadySignedUp?: boolean;
}

export function AutoApprovalIndicator({
  shiftId,
  onSignupClick,
  isSignedUp = false,
}: AutoApprovalIndicatorProps) {
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedUp) {
      checkEligibility();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId, isSignedUp]);

  const checkEligibility = async () => {
    try {
      const response = await fetch(`/api/shifts/${shiftId}/auto-approval-check`);
      if (response.ok) {
        const data = await response.json();
        setEligibility(data);
      }
    } catch (error) {
      console.error("Error checking auto-approval eligibility:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (isSignedUp || !eligibility) {
    return null;
  }

  if (eligibility.alreadySignedUp) {
    return null;
  }

  // Show auto-approval indicator
  if (eligibility.eligible) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Auto-Approve
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                You qualify for instant approval!
                {eligibility.ruleName && (
                  <>
                    <br />
                    <span className="text-xs opacity-80">Rule: {eligibility.ruleName}</span>
                  </>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {onSignupClick && (
          <Button 
            onClick={onSignupClick}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Sign Up - Instant Confirmation
          </Button>
        )}
      </div>
    );
  }

  // Show standard signup flow indicator
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-gray-600 border-gray-300">
              <Clock className="w-3 h-3 mr-1" />
              Pending Review
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Signup will be pending admin approval</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {onSignupClick && (
        <Button 
          onClick={onSignupClick}
          size="sm"
          variant="outline"
        >
          Sign Up
        </Button>
      )}
    </div>
  );
}

// Separate component for showing confirmation after auto-approval
interface AutoApprovalConfirmationProps {
  show: boolean;
  ruleName?: string;
  onClose: () => void;
}

export function AutoApprovalConfirmation({
  show,
  ruleName,
  onClose,
}: AutoApprovalConfirmationProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000); // Auto-hide after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-green-900">
              Automatically Approved!
            </h3>
            <p className="text-sm text-green-700 mt-1">
              Your shift signup was instantly confirmed
              {ruleName && (
                <>
                  {" "}by the <strong>{ruleName}</strong> rule
                </>
              )}
              .
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-green-600 hover:text-green-800"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}