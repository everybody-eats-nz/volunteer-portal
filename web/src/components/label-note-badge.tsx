"use client";

import { NotebookPen } from "lucide-react";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { type CustomLabel } from "@/generated/client";
import { cn } from "@/lib/utils";

export interface LabelNoteAuthor {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface LabelNoteBadgeProps {
  label: Pick<CustomLabel, "name" | "color" | "icon">;
  note?: string | null;
  assignedAt?: Date | string | null;
  assignedBy?: LabelNoteAuthor | null;
  size?: "sm" | "default" | "lg";
  className?: string;
  "data-testid"?: string;
}

function authorName(author: LabelNoteAuthor): string {
  return (
    [author.firstName, author.lastName].filter(Boolean).join(" ") ||
    author.name ||
    "An admin"
  );
}

/** "Added by Nic on 6 Nov 2026", whatever parts we know. */
export function labelNoteByline(
  assignedBy?: LabelNoteAuthor | null,
  assignedAt?: Date | string | null
): string | null {
  const date = assignedAt
    ? new Date(assignedAt).toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Pacific/Auckland",
      })
    : null;
  if (assignedBy && date) return `Added by ${authorName(assignedBy)} on ${date}`;
  if (assignedBy) return `Added by ${authorName(assignedBy)}`;
  if (date) return `Added on ${date}`;
  return null;
}

/**
 * A volunteer's custom label, with its note one click away. Labels without a
 * note render as the plain badge. Click rather than hover so it works on a
 * tablet at the pass as well as at a desk.
 */
export function LabelNoteBadge({
  label,
  note,
  assignedAt,
  assignedBy,
  size = "sm",
  className,
  "data-testid": testId,
}: LabelNoteBadgeProps) {
  if (!note) {
    return (
      <CustomLabelBadge
        label={label}
        size={size}
        className={className}
        data-testid={testId}
      />
    );
  }

  const byline = labelNoteByline(assignedBy, assignedAt);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex cursor-pointer items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            className
          )}
          aria-label={`${label.name} label - read the note`}
          data-testid={testId}
        >
          <CustomLabelBadge label={label} size={size} />
          <NotebookPen
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 space-y-2 p-3"
        align="start"
        data-testid={testId ? `${testId}-note` : undefined}
      >
        <CustomLabelBadge label={label} size="sm" />
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {note}
        </p>
        {byline && <p className="text-xs text-muted-foreground">{byline}</p>}
      </PopoverContent>
    </Popover>
  );
}
