"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/van/van-chrome";

export interface AdminOrganisation {
  id: string;
  name: string;
  isInternal: boolean;
  isCatchAll: boolean;
  isActive: boolean;
  vanCount: number;
  tripCount: number;
  driverCount: number;
}

export function VanOrganisationsContent({
  initial,
}: {
  initial: AdminOrganisation[];
}) {
  const [organisations, setOrganisations] = useState(initial);
  const [draft, setDraft] = useState("");
  const [draftIsInternal, setDraftIsInternal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  // The counts come from the server render; a PATCH returns the rows without
  // them, so they are carried across rather than reset to zero.
  const counts = new Map(
    organisations.map((o) => [
      o.id,
      { vans: o.vanCount, trips: o.tripCount, drivers: o.driverCount },
    ])
  );
  const selectableCount = organisations.filter(
    (o) => o.isActive && !o.isCatchAll
  ).length;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/van/organisations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not save that.");
        return;
      }
      setOrganisations(
        (data.organisations as AdminOrganisation[]).map((o) => ({
          ...o,
          vanCount: counts.get(o.id)?.vans ?? 0,
          tripCount: counts.get(o.id)?.trips ?? 0,
          driverCount: counts.get(o.id)?.drivers ?? 0,
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
      const response = await fetch("/api/admin/van/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.trim(),
          isInternal: draftIsInternal,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not add that.");
        return;
      }
      setOrganisations((current) =>
        [
          ...current,
          {
            ...data.organisation,
            vanCount: 0,
            tripCount: 0,
            driverCount: 0,
          } as AdminOrganisation,
        ].sort(
          (a, b) =>
            Number(b.isInternal) - Number(a.isInternal) ||
            a.name.localeCompare(b.name)
        )
      );
      setDraft("");
      setDraftIsInternal(false);
      toast.success(`${data.organisation.name} added`);
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="van-organisations-page">
      <Card>
        <CardContent className="p-0">
          <ul>
            {organisations.map((org) => (
              <li
                key={org.id}
                data-testid={`van-organisation-row-${org.id}`}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                {editing === org.id ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                      setEditing(null);
                      if (
                        editValue.trim().length >= 2 &&
                        editValue.trim() !== org.name
                      ) {
                        void patch({ id: org.id, name: editValue.trim() });
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
                      setEditing(org.id);
                      setEditValue(org.name);
                    }}
                    className="group flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-primary/5"
                  >
                    <span className="truncate text-[15px] font-medium">
                      {org.name}
                    </span>
                    <Pencil
                      className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                )}

                {/* The catch-all is a different kind of row, not a worse one:
                    it is where a one-off borrower gets named. Saying so is
                    what stops an admin trying to retire it and being refused. */}
                {org.isCatchAll ? (
                  <span className="shrink-0 text-[13px] text-muted-foreground">
                    Holds one-off borrowers
                  </span>
                ) : (
                  <label className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
                    <Switch
                      checked={org.isInternal}
                      disabled={busy}
                      onCheckedChange={(checked) =>
                        void patch({ id: org.id, isInternal: checked })
                      }
                      aria-label={`${org.name} is one of ours`}
                    />
                    One of ours
                  </label>
                )}

                <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                  {org.vanCount} {org.vanCount === 1 ? "van" : "vans"} ·{" "}
                  {org.driverCount}{" "}
                  {org.driverCount === 1 ? "driver" : "drivers"} ·{" "}
                  {org.tripCount} {org.tripCount === 1 ? "trip" : "trips"}
                </span>

                {org.isActive ? (
                  <StatusPill tone="available">Offered</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Retired</StatusPill>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  data-testid={`van-organisation-retire-${org.id}`}
                  disabled={
                    busy ||
                    org.isCatchAll ||
                    (org.isActive && selectableCount === 1)
                  }
                  onClick={() =>
                    void patch({ id: org.id, isActive: !org.isActive })
                  }
                >
                  {org.isActive ? "Retire" : "Restore"}
                </Button>
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
              <Label htmlFor="van-new-organisation">Add an organisation</Label>
              <Input
                id="van-new-organisation"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Kaibosh Food Rescue"
                className="mt-1.5"
                data-testid="van-organisation-new-name"
              />
            </div>
            <label className="flex items-center gap-2 pb-2.5 text-[13px] text-muted-foreground">
              <Switch
                checked={draftIsInternal}
                onCheckedChange={setDraftIsInternal}
                aria-label="One of ours"
              />
              One of ours
            </label>
            <Button
              type="submit"
              disabled={draft.trim().length < 2 || busy}
              className="mb-0.5"
              data-testid="van-organisation-add"
            >
              <Check aria-hidden />
              Add
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            &ldquo;One of ours&rdquo; sorts an organisation to the top of the
            list drivers pick from. Nothing is ever deleted — vans, drivers and
            trips point at these, so retiring is what hides one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
