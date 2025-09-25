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
import { Settings, Eye, Users, Lock, UserCheck } from "lucide-react";
import { MotionSpinner } from "@/components/motion-spinner";

interface PrivacySettings {
  friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
  allowFriendRequests: boolean;
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

  const handleClose = () => {
    onOpenChange(false);
    setError("");
    setHasChanges(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader className="pb-4">
          <ResponsiveDialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Friend Privacy Settings</span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium flex items-center space-x-2 mb-3">
                <Eye className="h-4 w-4" />
                <span>Who can see your volunteer activity?</span>
              </Label>
              <RadioGroup
                value={settings.friendVisibility}
                onValueChange={handleVisibilityChange}
                className="space-y-3"
              >
                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem
                    value="PUBLIC"
                    id="public"
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="public"
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Public</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Anyone can see which shifts you&apos;ve signed up for
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem
                    value="FRIENDS_ONLY"
                    id="friends"
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="friends"
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span className="font-medium">Friends Only</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Only your friends can see which shifts you&apos;ve signed
                      up for
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem
                    value="PRIVATE"
                    id="private"
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="private"
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Lock className="h-4 w-4" />
                      <span className="font-medium">Private</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Nobody can see which shifts you&apos;ve signed up for
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Friend Requests</Label>
              <div className="flex items-start space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id="allowRequests"
                  checked={settings.allowFriendRequests}
                  onCheckedChange={handleAllowRequestsChange}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="allowRequests"
                    className="cursor-pointer font-medium"
                  >
                    Allow friend requests
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Other volunteers can send you friend requests
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4">
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
