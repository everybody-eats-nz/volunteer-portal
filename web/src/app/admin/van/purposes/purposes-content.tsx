"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/van/van-chrome";

export interface AdminPurpose {
  id: string;
  label: string;
  requiresNote: boolean;
  isActive: boolean;
  sortOrder: number;
  tripCount: number;
}

export function VanPurposesContent({
  initial,
}: {
  initial: AdminPurpose[];
}) {
  const [purposes, setPurposes] = useState(initial);
  const [draft, setDraft] = useState("");
  const [draftRequiresNote, setDraftRequiresNote] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = new Map(purposes.map((p) => [p.id, p.tripCount]));
  const activeCount = purposes.filter((p) => p.isActive).length;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/van/purposes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not save that.");
        return;
      }
      setPurposes(
        (data.purposes as AdminPurpose[]).map((p) => ({
          ...p,
          tripCount: counts.get(p.id) ?? 0,
        }))
      );
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (draft.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/van/purposes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draft.trim(),
          requiresNote: draftRequiresNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not add that.");
        return;
      }
      setPurposes((current) => [
        ...current,
        { ...data.purpose, tripCount: 0 },
      ]);
      setDraft("");
      setDraftRequiresNote(false);
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="van-purposes-page">
      <Card>
        <CardContent className="p-0">
          <ul>
            {purposes.map((purpose, index) => (
              <li
                key={purpose.id}
                data-testid={`van-purpose-row-${purpose.id}`}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                {editing === purpose.id ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      setEditing(null);
                      if (editValue.trim().length >= 2 && editValue !== purpose.label) {
                        void patch({ id: purpose.id, label: editValue.trim() });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-9 min-w-0 flex-1"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(purpose.id);
                      setEditValue(purpose.label);
                    }}
                    className="group flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-primary/5"
                  >
                    <span className="truncate text-[15px] font-medium">
                      {purpose.label}
                    </span>
                    <Pencil
                      className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                )}

                <label className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
                  <Switch
                    checked={purpose.requiresNote}
                    onCheckedChange={(checked) =>
                      void patch({ id: purpose.id, requiresNote: checked })
                    }
                    aria-label={`Ask for a note when ${purpose.label} is picked`}
                  />
                  Asks for a note
                </label>

                <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                  {purpose.tripCount} trips
                </span>

                {purpose.isActive ? (
                  <StatusPill tone="available">Shown</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Retired</StatusPill>
                )}

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${purpose.label} up`}
                    disabled={index === 0 || busy}
                    onClick={() => void patch({ id: purpose.id, move: -1 })}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${purpose.label} down`}
                    disabled={index === purposes.length - 1 || busy}
                    onClick={() => void patch({ id: purpose.id, move: 1 })}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || (purpose.isActive && activeCount === 1)}
                    onClick={() =>
                      void patch({ id: purpose.id, isActive: !purpose.isActive })
                    }
                  >
                    {purpose.isActive ? "Retire" : "Restore"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <div className="min-w-0 flex-1">
              <Label htmlFor="van-new-purpose">Add a purpose</Label>
              <Input
                id="van-new-purpose"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Community Fridge"
                className="mt-1.5"
                data-testid="van-purpose-new-label"
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-[13px] text-muted-foreground">
              <Switch
                checked={draftRequiresNote}
                onCheckedChange={setDraftRequiresNote}
                aria-label="Ask the driver for a note"
              />
              Asks for a note
            </label>
            <Button
              type="submit"
              disabled={draft.trim().length < 2 || busy}
              className="mb-0.5"
              data-testid="van-purpose-add"
            >
              <Check aria-hidden />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
