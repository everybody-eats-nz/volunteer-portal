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
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
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
