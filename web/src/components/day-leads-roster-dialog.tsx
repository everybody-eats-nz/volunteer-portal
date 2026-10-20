"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DAY_LEAD_NAME_MAX_LENGTH,
  DAY_LEAD_ROLES,
  DAY_LEAD_ROLE_LABELS,
  ROSTER_WEEKDAYS,
  normalizeLeadName,
  type DayLeadRole,
  type DayLeads,
} from "@/lib/day-leads";

type RosterDraft = Record<number, Record<DayLeadRole, string>>;

interface DayLeadsRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  /** The weekday of the day being viewed, marked so it is easy to find. */
  highlightDayOfWeek: number;
  roster: Record<number, DayLeads>;
  suggestions: string[];
}

function toDraft(roster: Record<number, DayLeads>): RosterDraft {
  return Object.fromEntries(
    ROSTER_WEEKDAYS.map(({ dayOfWeek }) => [
      dayOfWeek,
      {
        chef: roster[dayOfWeek]?.chef ?? "",
        fohManager: roster[dayOfWeek]?.fohManager ?? "",
      },
    ])
  );
}

/**
 * The location's standard weekly roster of Chefs and FOH Managers. Every
 * service day follows it unless that day has been changed on its own.
 */
export function DayLeadsRosterDialog({
  open,
  onOpenChange,
  location,
  highlightDayOfWeek,
  roster,
  suggestions,
}: DayLeadsRosterDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState(() => toDraft(roster));
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const idPrefix = useId();
  const suggestionsId = `${idPrefix}-names`;

  const isDirty = ROSTER_WEEKDAYS.some(({ dayOfWeek }) =>
    DAY_LEAD_ROLES.some(
      (role) =>
        normalizeLeadName(draft[dayOfWeek][role]) !== saved[dayOfWeek][role]
    )
  );

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    // Reopening starts from what is saved, not a draft that was abandoned.
    if (!next) setDraft(saved);
    onOpenChange(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const days = ROSTER_WEEKDAYS.map(({ dayOfWeek }) => ({
        dayOfWeek,
        chef: normalizeLeadName(draft[dayOfWeek].chef),
        fohManager: normalizeLeadName(draft[dayOfWeek].fohManager),
      }));
      const res = await fetch("/api/admin/day-leads/roster", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, days }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Couldn't save the standard roster. Try again.");
        return;
      }
      const next = toDraft(data.roster);
      setSaved(next);
      setDraft(next);
      onOpenChange(false);
      toast.success(`Standard roster saved for ${location}`);
      startTransition(() => router.refresh());
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="day-leads-roster-dialog">
        <DialogHeader>
          <DialogTitle>Standard roster for {location}</DialogTitle>
          <DialogDescription>
            Who usually runs each day. Every service day uses these names
            unless you change that day on its own for a swap or a cover.
          </DialogDescription>
        </DialogHeader>

        <form
          id={`${idPrefix}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            if (isDirty && !saving) save();
          }}
        >
          <table className="w-full border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-28 pb-1 font-medium">
                  <span className="sr-only">Day</span>
                </th>
                {DAY_LEAD_ROLES.map((role) => (
                  <th key={role} scope="col" className="pb-1 pl-2 font-medium">
                    {DAY_LEAD_ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROSTER_WEEKDAYS.map(({ dayOfWeek, label }) => {
                const isHighlighted = dayOfWeek === highlightDayOfWeek;
                return (
                  <tr key={dayOfWeek} data-testid={`day-leads-roster-row-${dayOfWeek}`}>
                    <th
                      scope="row"
                      className={cn(
                        "pr-2 text-left font-medium",
                        isHighlighted ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {label}
                        {isHighlighted && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                            aria-label="(the day you are viewing)"
                          />
                        )}
                      </span>
                    </th>
                    {DAY_LEAD_ROLES.map((role) => (
                      <td key={role} className="pl-2">
                        <Input
                          aria-label={`${label} ${DAY_LEAD_ROLE_LABELS[role]}`}
                          value={draft[dayOfWeek][role]}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [dayOfWeek]: {
                                ...prev[dayOfWeek],
                                [role]: e.target.value,
                              },
                            }))
                          }
                          maxLength={DAY_LEAD_NAME_MAX_LENGTH}
                          placeholder="First name"
                          list={suggestionsId}
                          autoComplete="off"
                          className="h-9 [&::-webkit-calendar-picker-indicator]:hidden"
                          data-testid={`day-leads-roster-${dayOfWeek}-${role}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id={suggestionsId}>
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={`${idPrefix}-form`}
            disabled={!isDirty || saving}
            className="min-w-28"
            data-testid="day-leads-roster-save"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save roster"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
