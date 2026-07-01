"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Volunteer IDs to add to the new group. */
  memberIds: string[];
  /** Stored on the group for provenance (e.g. report filters). */
  filters?: Record<string, unknown>;
  /** Prefilled group name. */
  defaultName?: string;
  /** Called after the group is created successfully. */
  onCreated?: () => void;
}

export function CreateNotificationGroupDialog({
  open,
  onOpenChange,
  memberIds,
  filters,
  defaultName = "",
  onCreated,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const count = memberIds.length;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please give the group a name");
      return;
    }
    if (count === 0) {
      toast.error("Select at least one volunteer");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/notification-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
          filters: filters ?? {},
          memberIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create group");
      }
      toast.success(
        `Created "${trimmed}" with ${count} volunteer${count === 1 ? "" : "s"}`
      );
      onCreated?.();
      onOpenChange(false);
      // Clear the form so a re-open starts fresh rather than showing the
      // just-used name (which would collide with the group we just created).
      setName("");
      setDescription("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create group"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            Create notification group
          </DialogTitle>
          <DialogDescription>
            Save these {count} volunteer{count === 1 ? "" : "s"} as a group you
            can target when sending shortage alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="group-name">
              Group name<span className="text-red-500"> *</span>
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reliable shortage responders"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">Description</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — what this group is for"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || count === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
