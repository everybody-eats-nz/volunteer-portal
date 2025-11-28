"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { YearInReviewDialog } from "./YearInReviewDialog";
import { Sparkles } from "lucide-react";

interface YearInReviewButtonProps {
  year?: number;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function YearInReviewButton({
  year,
  variant = "default",
  size = "default",
  className,
}: YearInReviewButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setDialogOpen(true)}
        className={className}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {year ? `${year} Year in Review` : "Year in Review"}
      </Button>

      <YearInReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultYear={year}
      />
    </>
  );
}
