"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareShiftButtonProps {
  url: string;
  title: string;
  text: string;
}

export function ShareShiftButton({ url, title, text }: ShareShiftButtonProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleShare = async () => {
    // Web Share API exists on modern desktop browsers too (macOS Safari/Chrome
    // route it to the OS share sheet), but on a desktop with a mouse the user
    // really just wants the link in their clipboard. Restrict the native sheet
    // to coarse-pointer devices (phones, tablets), copy-to-clipboard elsewhere.
    const prefersNativeShare =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (prefersNativeShare) {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        // Fall through to clipboard if the native sheet rejected for any
        // other reason (permission, transient OS error, etc.).
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      toast.success("Link copied", {
        description: "Share it with your whānau to invite them along.",
      });
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link", {
        description: "Please copy the URL from your address bar.",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleShare}
      aria-label="Share this shift"
    >
      {justCopied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </>
      )}
    </Button>
  );
}
