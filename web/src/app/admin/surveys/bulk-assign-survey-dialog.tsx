"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Users, Loader2, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { SURVEY_TRIGGER_DISPLAY } from "@/types/survey";
import type { SurveyTriggerType } from "@/generated/client";

interface Survey {
  id: string;
  title: string;
  triggerType: SurveyTriggerType;
  triggerValue: number;
  triggerMaxValue: number | null;
}

interface PreviewData {
  eligibleUserIds: string[];
  totalEligible: number;
  alreadyAssigned: number;
  sampleUsers: { id: string; name: string | null; email: string }[];
}

interface BulkAssignSurveyDialogProps {
  survey: Survey;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: () => void;
}

export function BulkAssignSurveyDialog({
  survey,
  open,
  onOpenChange,
  onAssigned,
}: BulkAssignSurveyDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/surveys/${survey.id}/bulk-assign`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load preview");
      }
      const data: PreviewData = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview");
    } finally {
      setIsLoading(false);
    }
  }, [survey.id]);

  useEffect(() => {
    if (open) {
      setPreview(null);
      setError(null);
      fetchPreview();
    }
  }, [open, fetchPreview]);

  const handleBulkAssign = async () => {
    setIsAssigning(true);
    try {
      const response = await fetch(
        `/api/admin/surveys/${survey.id}/bulk-assign`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to assign survey");
      }
      const result = await response.json();

      toast({
        title: "Bulk Assignment Complete",
        description: result.message,
      });

      onOpenChange(false);
      onAssigned?.();
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to assign survey",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const triggerDisplay = SURVEY_TRIGGER_DISPLAY[survey.triggerType];
  const triggerDescription =
    survey.triggerType === "MANUAL"
      ? "All volunteers (manual assignment)"
      : survey.triggerMaxValue !== null
        ? `${triggerDisplay.label}: ${survey.triggerValue}–${survey.triggerMaxValue}`
        : `${triggerDisplay.label}: ${survey.triggerValue}+`;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[480px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Assign Survey
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Assign &quot;{survey.title}&quot; to all eligible users matching the
            trigger criteria.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Trigger info */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">Trigger Criteria</p>
            <p className="text-muted-foreground">{triggerDescription}</p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Finding eligible users...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Preview results */}
          {preview && !isLoading && (
            <>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">
                      {preview.totalEligible}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Eligible Users
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">
                      {preview.alreadyAssigned}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Already Assigned
                    </p>
                  </div>
                </div>

                {/* Sample users */}
                {preview.sampleUsers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      {preview.totalEligible <= 10
                        ? "Eligible users:"
                        : `Sample of ${preview.sampleUsers.length} eligible users:`}
                    </p>
                    <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                      {preview.sampleUsers.map((user) => (
                        <div
                          key={user.id}
                          className="px-3 py-2 text-sm flex justify-between"
                        >
                          <span className="font-medium truncate">
                            {user.name || "Unnamed"}
                          </span>
                          <span className="text-muted-foreground truncate ml-2">
                            {user.email}
                          </span>
                        </div>
                      ))}
                    </div>
                    {preview.totalEligible > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ...and {preview.totalEligible - 10} more
                      </p>
                    )}
                  </div>
                )}

                {preview.totalEligible === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No eligible users found.</p>
                    <p className="text-xs mt-1">
                      All matching users have already been assigned this survey.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <EmailPreviewDialog
              emailType="surveyNotification"
              triggerLabel="Preview Email"
              triggerVariant="outline"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isAssigning}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAssign}
                disabled={
                  isLoading ||
                  isAssigning ||
                  !preview ||
                  preview.totalEligible === 0
                }
                data-testid="bulk-assign-survey-submit"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Assign to {preview?.totalEligible || 0} Users
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
