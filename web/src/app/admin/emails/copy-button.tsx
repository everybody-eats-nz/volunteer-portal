"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  /** The text put on the clipboard. */
  value: string;
  /** What is being copied, for screen readers: "Copy {label}". */
  label: string;
  testId?: string;
}

/** A small icon button that copies a value and confirms with a tick. */
export function CopyButton({ value, label, testId }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 sm:size-7 text-muted-foreground hover:text-foreground"
      onClick={copy}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      data-testid={testId}
    >
      {copied ? (
        <Check className="size-3.5 text-primary-text" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
    </Button>
  );
}
