"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * The per-shift auto-approval switch, for any shift form. Posts
 * `autoApprovalEnabled` as "1" or "0" through a hidden input, so it works in
 * plain server-action forms too.
 */
export function AutoApprovalToggle({
  defaultEnabled = true,
}: {
  defaultEnabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultEnabled);

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <Label htmlFor="autoApprovalEnabled-switch" className="text-sm font-medium">
          Auto-approve signups
        </Label>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "Volunteers who meet the auto-approval rules are confirmed straight away."
            : "Every signup waits for the team, and waitlist places aren't offered automatically. Good for special events you want to hand-pick."}
        </p>
      </div>
      <input
        type="hidden"
        name="autoApprovalEnabled"
        value={enabled ? "1" : "0"}
      />
      <Switch
        id="autoApprovalEnabled-switch"
        checked={enabled}
        onCheckedChange={setEnabled}
        data-testid="shift-auto-approval-switch"
      />
    </div>
  );
}
