"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface Recipient {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  unlockedAt: string;
}

interface AchievementRecipientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievementId: string | null;
  achievementName: string;
  achievementIcon: string;
}

export function AchievementRecipientsDialog({
  open,
  onOpenChange,
  achievementId,
  achievementName,
  achievementIcon,
}: AchievementRecipientsDialogProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (open && achievementId && loaded !== achievementId) {
      setLoading(true);
      setError(null);
      fetch(`/api/admin/achievements/${achievementId}/users`)
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch recipients");
          return response.json();
        })
        .then((data) => {
          setRecipients(data);
          setLoaded(achievementId);
        })
        .catch(() => {
          setError("Failed to load recipients");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, achievementId, loaded]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-NZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{achievementIcon}</span>
            {achievementName}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <p className="text-center text-sm text-destructive py-8">
              {error}
            </p>
          ) : recipients.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-8">
              No one has unlocked this achievement yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-3">
                {recipients.length} volunteer{recipients.length !== 1 && "s"}{" "}
                unlocked this achievement
              </p>
              {recipients.map((recipient) => (
                <div
                  key={recipient.userId}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={recipient.image || undefined}
                      alt={recipient.name || "User"}
                    />
                    <AvatarFallback className="text-xs">
                      {getInitials(recipient.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {recipient.name || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {recipient.email}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {formatDate(recipient.unlockedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
