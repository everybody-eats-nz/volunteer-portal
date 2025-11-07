"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!session?.impersonating) {
    return null;
  }

  const handleStopImpersonation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/stop-impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to stop impersonation");
      }

      // Update session to remove impersonation
      await update({
        stopImpersonation: true,
      });

      // Redirect back to admin
      router.push("/admin/users");
      router.refresh();
    } catch (error) {
      console.error("Stop impersonation error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to stop impersonation. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-orange-500 dark:bg-orange-600 text-white px-4 py-3 shadow-lg sticky top-0 z-50"
      data-testid="impersonation-banner"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="text-sm font-medium">
            <span className="font-semibold">Impersonating:</span>{" "}
            {session.user?.name || session.user?.email}
            <span className="mx-2">•</span>
            <span className="opacity-90">
              Logged in as: {session.impersonating.adminName || session.impersonating.adminEmail}
            </span>
          </div>
        </div>
        <Button
          onClick={handleStopImpersonation}
          disabled={isLoading}
          size="sm"
          variant="secondary"
          className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 flex-shrink-0"
          data-testid="stop-impersonation-button"
        >
          <X className="h-4 w-4" />
          {isLoading ? "Stopping..." : "Stop Impersonating"}
        </Button>
      </div>
    </div>
  );
}
