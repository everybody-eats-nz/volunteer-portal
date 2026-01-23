"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EmailPreviewData {
  SmartEmailID: string;
  Name: string;
  CreatedAt: string;
  Status: string;
  Properties: {
    From: string;
    ReplyTo: string;
    Subject: string;
    HtmlPreviewUrl?: string;
  };
}

type EmailType =
  | "shortage"
  | "cancellation"
  | "confirmation"
  | "volunteerCancellation"
  | "volunteerNotNeeded"
  | "emailVerification"
  | "parentalConsentApproval"
  | "userInvitation"
  | "profileCompletion"
  | "migration"
  | "surveyNotification";

interface EmailPreviewDialogProps {
  emailType: EmailType;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export function EmailPreviewDialog({
  emailType,
  triggerLabel = "Preview Email",
  triggerVariant = "outline",
}: EmailPreviewDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<EmailPreviewData | null>(null);

  const fetchPreview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/emails/preview/${emailType}`);
      if (!response.ok) {
        throw new Error("Failed to fetch email preview");
      }
      const data = await response.json();

      // Fix HTTP URLs to HTTPS
      if (data?.Properties?.HtmlPreviewUrl) {
        data.Properties.HtmlPreviewUrl = data.Properties.HtmlPreviewUrl.replace(
          /^http:/,
          "https:"
        );
      }

      setPreviewData(data);
    } catch (error) {
      console.error("Error fetching email preview:", error);
      toast.error("Failed to load email preview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !previewData) {
      fetchPreview();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} data-testid="preview-email-button">
          <Eye className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Email Template Preview</DialogTitle>
          <DialogDescription>
            Preview the email template that will be sent to volunteers
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!isLoading && previewData && (
          <div className="flex-1 overflow-auto space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Template Name:</span>{" "}
                {previewData.Name}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <span
                  className={
                    previewData.Status === "Active"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {previewData.Status}
                </span>
              </div>
              <div>
                <span className="font-medium">From:</span>{" "}
                {previewData.Properties.From}
              </div>
              <div>
                <span className="font-medium">Reply To:</span>{" "}
                {previewData.Properties.ReplyTo}
              </div>
              <div className="col-span-2">
                <span className="font-medium">Subject:</span>{" "}
                {previewData.Properties.Subject}
              </div>
            </div>

            {previewData.Properties.HtmlPreviewUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    src={previewData.Properties.HtmlPreviewUrl}
                    className="w-full h-[600px]"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(previewData.Properties.HtmlPreviewUrl, "_blank")
                  }
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Preview not available
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-4 border-t">
              Note: This preview shows the template with placeholder variables.
              Actual emails will have these replaced with real data (volunteer
              name, shift details, etc.)
            </div>
          </div>
        )}

        {!isLoading && !previewData && (
          <div className="text-center text-muted-foreground py-8">
            Failed to load preview
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
