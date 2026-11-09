"use client";

import { ExternalLink, Eye } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TemplatePreviewDialogProps {
  /** The portal's name for the email, e.g. "Shift confirmation". */
  emailName: string;
  /** The template's name in Campaign Monitor. */
  templateName: string;
  subject: string | null;
  /** Campaign Monitor's hosted preview of the template. */
  previewUrl: string;
}

/** Shows Campaign Monitor's preview of a template without leaving the page. */
export function TemplatePreviewDialog({
  emailName,
  templateName,
  subject,
  previewUrl,
}: TemplatePreviewDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`Preview ${emailName}`}
          data-testid="email-template-preview"
        >
          <Eye className="size-3.5" aria-hidden />
          Preview
        </button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[95vh] w-[95vw] max-w-4xl flex-col overflow-hidden sm:max-w-4xl"
        data-testid="email-template-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle>{emailName}</DialogTitle>
          <DialogDescription>
            {subject ? `Subject: ${subject}` : templateName}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-white">
          <iframe
            src={previewUrl}
            title={`Preview of ${emailName}`}
            className="h-[65vh] w-full"
            sandbox="allow-same-origin"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-xs text-muted-foreground">
            This is the template as saved in Campaign Monitor. Real emails
            have the variables filled in.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open in a new tab
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
