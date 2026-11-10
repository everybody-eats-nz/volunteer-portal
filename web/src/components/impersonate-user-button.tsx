"use client";

import { useState } from "react";
import { useHydrationSafeSession } from "@/hooks/use-hydration-safe-session";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserCog } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ImpersonateUserButtonProps {
  userId: string;
  userName: string;
}

export function ImpersonateUserButton({
  userId,
  userName,
}: ImpersonateUserButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, update } = useHydrationSafeSession();
  const router = useRouter();

  // Don't show button if already impersonating or not an admin
  if (session?.impersonating || session?.user?.role !== "ADMIN") {
    return null;
  }

  // Don't allow impersonating yourself
  if (session?.user?.id === userId) {
    return null;
  }

  const handleImpersonate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start impersonation");
      }

      // The route above is only the friendly pre-check. The session switch
      // itself re-verifies the admin and loads the target server-side, so
      // all it needs from here is who to impersonate.
      const updated = await update({
        startImpersonation: { targetUserId: userId },
      });
      if (!updated?.impersonating) {
        throw new Error("Failed to start impersonation");
      }

      // Redirect to user dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Impersonation error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to start impersonation. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="impersonate-user-button"
          disabled={isLoading}
        >
          <UserCog className="h-4 w-4" />
          Impersonate User
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impersonate User</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to impersonate <strong>{userName}</strong>. You will
            see the application as this user sees it and can perform actions on
            their behalf.
            <br />
            <br />
            An impersonation banner will be displayed at the top of the page to
            remind you that you&apos;re impersonating a user. You can stop
            impersonating at any time by clicking the &quot;Stop
            Impersonating&quot; button in the banner.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleImpersonate}
            disabled={isLoading}
            data-testid="confirm-impersonate"
          >
            {isLoading ? "Starting..." : "Start Impersonation"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
