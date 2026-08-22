"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Users, Lock, UserCheck } from "lucide-react";
import { MotionSpinner } from "@/components/motion-spinner";

/* Option rows — soft cards with a forest tint when selected, matching the
   marketing-styled form language. `has-data-[state=checked]` reads the Radix
   state off the radio/checkbox inside. Rendered as a <label> so the whole
   row (title and description included) toggles the control. */
const optionRow =
  "flex cursor-pointer items-start gap-3 rounded-2xl border border-forest-500/15 p-4 transition-colors hover:bg-forest-500/5 has-data-[state=checked]:border-forest-500/40 has-data-[state=checked]:bg-forest-500/5 dark:border-cream-50/15 dark:hover:bg-cream-50/5 dark:has-data-[state=checked]:border-cream-50/40 dark:has-data-[state=checked]:bg-cream-50/5";

const optionTitle =
  "flex items-center gap-2 text-sm font-medium leading-none text-forest-700 dark:text-cream-50";

interface PrivacySettings {
  friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
  allowFriendRequests: boolean;
  allowFriendSuggestions: boolean;
}

interface FriendPrivacySettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FriendPrivacySettings({
  open,
  onOpenChange,
}: FriendPrivacySettingsProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    friendVisibility: "FRIENDS_ONLY",
    allowFriendRequests: true,
    allowFriendSuggestions: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPrivacySettings();
    }
  }, [open]);

  const fetchPrivacySettings = async () => {
    try {
      const response = await fetch("/api/friends/privacy");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Error fetching privacy settings:", error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/friends/privacy", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setHasChanges(false);
        onOpenChange(false);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update privacy settings");
      }
    } catch (error) {
      console.error(error);
      setError("An error occurred while updating privacy settings");
    } finally {
      setLoading(false);
    }
  };

  const handleVisibilityChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      friendVisibility: value as PrivacySettings["friendVisibility"],
    }));
    setHasChanges(true);
  };

  const handleAllowRequestsChange = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      allowFriendRequests: checked,
    }));
    setHasChanges(true);
  };

  const handleAllowSuggestionsChange = (checked: boolean) => {
    setSettings((prev) => ({
      ...prev,
      allowFriendSuggestions: checked,
    }));
    setHasChanges(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    setError("");
    setHasChanges(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-lg">
        <ResponsiveDialogHeader className="pb-4">
          <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            You decide who sees what
          </p>
          <ResponsiveDialogTitle className="display display-medium mt-2 text-2xl tracking-tight text-forest-700 dark:text-cream-50">
            Friend Privacy Settings
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="mb-3 flex items-center gap-2 text-base font-medium text-forest-700 dark:text-cream-50">
                <Eye className="h-4 w-4" aria-hidden />
                <span>Who can see your volunteer activity?</span>
              </Label>
              <RadioGroup
                value={settings.friendVisibility}
                onValueChange={handleVisibilityChange}
                className="space-y-3"
              >
                <label htmlFor="public" className={optionRow}>
                  <RadioGroupItem
                    value="PUBLIC"
                    id="public"
                    className="mt-0.5"
                  />
                  <div className="space-y-1.5">
                    <span className={optionTitle}>
                      <Users className="h-4 w-4" aria-hidden />
                      <span>Public</span>
                    </span>
                    <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
                      Any logged-in volunteer can see your profile, shared shift
                      history, and which shifts you&apos;ve signed up for on the
                      browse shifts page.
                    </p>
                  </div>
                </label>

                <label htmlFor="friends" className={optionRow}>
                  <RadioGroupItem
                    value="FRIENDS_ONLY"
                    id="friends"
                    className="mt-0.5"
                  />
                  <div className="space-y-1.5">
                    <span className={optionTitle}>
                      <UserCheck className="h-4 w-4" aria-hidden />
                      <span>Friends Only</span>
                    </span>
                    <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
                      Only your friends can see your profile, shared shift
                      history, and which shifts you&apos;ve signed up for on the
                      browse shifts page.
                    </p>
                  </div>
                </label>

                <label htmlFor="private" className={optionRow}>
                  <RadioGroupItem
                    value="PRIVATE"
                    id="private"
                    className="mt-0.5"
                  />
                  <div className="space-y-1.5">
                    <span className={optionTitle}>
                      <Lock className="h-4 w-4" aria-hidden />
                      <span>Private</span>
                    </span>
                    <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
                      Your profile cannot be viewed, you won&apos;t appear on
                      the browse shifts page, and your shift history will be
                      hidden from everyone.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium text-forest-700 dark:text-cream-50">
                Additional Settings
              </Label>
              <div className="space-y-3">
                <label htmlFor="allowRequests" className={optionRow}>
                  <Checkbox
                    id="allowRequests"
                    checked={settings.allowFriendRequests}
                    onCheckedChange={handleAllowRequestsChange}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <span className={optionTitle}>Allow friend requests</span>
                    <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
                      Other volunteers can send you friend requests
                    </p>
                  </div>
                </label>

                <label htmlFor="allowSuggestions" className={optionRow}>
                  <Checkbox
                    id="allowSuggestions"
                    checked={settings.allowFriendSuggestions}
                    onCheckedChange={handleAllowSuggestionsChange}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <span className={optionTitle}>
                      Appear in friend suggestions
                    </span>
                    <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
                      Show up as a suggested friend for volunteers you&apos;ve
                      recently worked with (3+ shared shifts in the last 3
                      months)
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !hasChanges}>
              {loading ? (
                <>
                  <MotionSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
