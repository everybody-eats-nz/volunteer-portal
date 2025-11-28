"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useYearInReviewRender } from "@/hooks/useYearInReviewRender";
import { Download, Share2, Sparkles, Film, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface YearInReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear?: number;
}

export function YearInReviewDialog({
  open,
  onOpenChange,
  defaultYear,
}: YearInReviewDialogProps) {
  const [selectedYear, setSelectedYear] = useState(
    defaultYear || new Date().getFullYear()
  );
  const { status, progress, videoUrl, error, startRender, reset, isLoading } =
    useYearInReviewRender();

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleDownload = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `year-in-review-${selectedYear}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download video:", err);
    }
  };

  const handleShare = async () => {
    if (!videoUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `My ${selectedYear} Volunteer Year in Review`,
          text: `Check out my volunteering impact in ${selectedYear}!`,
          url: videoUrl,
        });
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(videoUrl);
        alert("Video link copied to clipboard!");
      }
    } catch (err) {
      console.error("Failed to share:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Your {selectedYear} Year in Review
          </DialogTitle>
          <DialogDescription>
            Relive your volunteering journey and celebrate your impact
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Year Selection (only show if idle) */}
          {status === "idle" && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="year"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Select Year
                </label>
                <select
                  id="year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="mt-1.5 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() - i
                  ).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={() => startRender(selectedYear)}
                size="lg"
                className="w-full"
              >
                <Film className="mr-2 h-5 w-5" />
                Generate My Video
              </Button>
            </div>
          )}

          {/* Progress State */}
          {(status === "checking" || status === "rendering") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="mx-auto mb-4 h-16 w-16"
                >
                  <Film className="h-full w-full text-primary" />
                </motion.div>
                <h3 className="text-lg font-semibold">
                  {status === "checking"
                    ? "Preparing your video..."
                    : "Creating your year in review..."}
                </h3>
                <p className="text-sm text-muted-foreground">
                  This may take up to a minute
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </motion.div>
          )}

          {/* Completed State */}
          {status === "completed" && videoUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  src={videoUrl}
                  controls
                  className="w-full"
                  playsInline
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  onClick={handleShare}
                  variant="outline"
                  className="flex-1"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>

              <Button onClick={reset} variant="ghost" className="w-full">
                Create Another Year
              </Button>
            </motion.div>
          )}

          {/* Error State */}
          {status === "failed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || "Failed to generate video"}</AlertDescription>
              </Alert>

              <Button onClick={reset} variant="outline" className="w-full">
                Try Again
              </Button>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
