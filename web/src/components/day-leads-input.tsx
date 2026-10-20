"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarSync, ChefHat, Loader2, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DAY_LEAD_NAME_MAX_LENGTH,
  DAY_LEAD_ROLES,
  DAY_LEAD_ROLE_LABELS,
  isEmptyDayLeads,
  normalizeLeadName,
  type DayLeadRole,
  type DayLeads,
} from "@/lib/day-leads";
import { DayLeadsRosterDialog } from "@/components/day-leads-roster-dialog";

interface DayLeadsInputProps {
  date: string; // YYYY-MM-DD (NZ day)
  location: string;
  /** e.g. "Tuesday" - names the standard roster this day follows. */
  weekdayLabel: string;
  dayOfWeek: number;
  standard: DayLeads;
  override: DayLeads;
  roster: Record<number, DayLeads>;
  suggestions: string[];
}

/**
 * Admin editor for the Chef and FOH Manager running this day, which
 * volunteers see by first name on the shift calendar. The names come from
 * the location's standard weekly roster; editing a day only changes that day,
 * for a swap or a cover. Leaving a field blank keeps the standard name.
 */
export function DayLeadsInput({
  date,
  location,
  weekdayLabel,
  dayOfWeek,
  standard,
  override: initialOverride,
  roster,
  suggestions,
}: DayLeadsInputProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [override, setOverride] = useState(initialOverride);
  const [draft, setDraft] = useState(() => toDraft(initialOverride));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<"save" | "reset" | null>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const idPrefix = useId();
  const suggestionsId = `${idPrefix}-names`;

  const effective: DayLeads = {
    chef: override.chef || standard.chef,
    fohManager: override.fohManager || standard.fohManager,
  };
  const hasOverride = !isEmptyDayLeads(override);
  const isDirty = DAY_LEAD_ROLES.some(
    (role) => normalizeLeadName(draft[role]) !== (override[role] ?? "")
  );

  const persist = async (next: Record<DayLeadRole, string>, action: "save" | "reset") => {
    setSaving(action);
    try {
      const res = await fetch("/api/admin/day-leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, location, ...next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(
          data?.error || "Couldn't save the chef and FOH manager. Try again."
        );
        return;
      }
      const saved: DayLeads = data.override;
      setOverride(saved);
      setDraft(toDraft(saved));
      setOpen(false);
      toast.success(
        action === "reset"
          ? `Back to the standard ${weekdayLabel} roster`
          : "Chef and FOH manager saved for this day"
      );
      startTransition(() => router.refresh());
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  const cancel = () => {
    setDraft(toDraft(override));
    setOpen(false);
  };

  const rosterDialog = (
    <DayLeadsRosterDialog
      open={rosterOpen}
      onOpenChange={setRosterOpen}
      location={location}
      highlightDayOfWeek={dayOfWeek}
      roster={roster}
      suggestions={suggestions}
    />
  );

  const suggestionList = (
    <datalist id={suggestionsId}>
      {suggestions.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );

  if (!open) {
    return (
      <div
        className="mb-6 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-sm"
        data-testid="day-leads-summary"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ChefHat className="h-4 w-4 shrink-0 text-muted-foreground" />
          Running the day
        </span>
        {isEmptyDayLeads(effective) ? (
          <span className="text-sm text-muted-foreground">
            No chef or FOH manager listed
          </span>
        ) : (
          <dl className="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
            {DAY_LEAD_ROLES.map((role) => (
              <div key={role} className="flex min-w-0 items-baseline gap-1.5">
                <dt className="text-muted-foreground">
                  {DAY_LEAD_ROLE_LABELS[role]}
                </dt>
                <dd
                  className={cn(
                    "truncate font-medium",
                    !effective[role] && "font-normal text-muted-foreground"
                  )}
                  data-testid={`day-leads-summary-${role}`}
                >
                  {effective[role] ?? "Not set"}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {hasOverride && (
          <span
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
            data-testid="day-leads-changed-badge"
          >
            Changed for this day
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setRosterOpen(true)}
            data-testid="day-leads-roster-button"
          >
            <CalendarSync className="h-3.5 w-3.5" />
            Standard roster
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setOpen(true)}
            data-testid="day-leads-edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change for this day
          </Button>
        </div>
        {rosterDialog}
      </div>
    );
  }

  return (
    <Card
      className="@container mb-6 gap-0 border-border/70 px-5 py-4 shadow-sm"
      data-testid="day-leads-card"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty && !saving) persist(normalizeDraft(draft), "save");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving && !rosterOpen) cancel();
        }}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ChefHat className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Chef and FOH Manager for this day
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Volunteers see their first names on the shift calendar. A blank
              field uses the standard {weekdayLabel} roster.
            </p>
          </div>
        </div>

        <div className="grid gap-3 @lg:grid-cols-2">
          {DAY_LEAD_ROLES.map((role, index) => {
            const inputId = `${idPrefix}-${role}`;
            return (
              <div key={role} className="flex flex-col gap-1.5">
                <Label htmlFor={inputId} className="text-sm">
                  {DAY_LEAD_ROLE_LABELS[role]}
                </Label>
                <Input
                  id={inputId}
                  value={draft[role]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [role]: e.target.value }))
                  }
                  maxLength={DAY_LEAD_NAME_MAX_LENGTH}
                  placeholder={standard[role] ?? "First name"}
                  list={suggestionsId}
                  autoComplete="off"
                  autoFocus={index === 0}
                  className="h-10 [&::-webkit-calendar-picker-indicator]:hidden"
                  data-testid={`day-leads-${role}-input`}
                />
                <p className="text-xs text-muted-foreground">
                  {standard[role]
                    ? `Standard ${weekdayLabel}: ${standard[role]}`
                    : `No standard ${weekdayLabel} ${DAY_LEAD_ROLE_LABELS[role].toLowerCase()}`}
                </p>
              </div>
            );
          })}
        </div>
        {suggestionList}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            size="sm"
            className="h-10 min-w-20"
            disabled={!isDirty || saving !== null}
            data-testid="day-leads-save"
          >
            {saving === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 text-muted-foreground"
            disabled={saving !== null}
            onClick={cancel}
            data-testid="day-leads-cancel"
          >
            Cancel
          </Button>
          {hasOverride && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 text-muted-foreground"
              disabled={saving !== null}
              onClick={() => persist({ chef: "", fohManager: "" }, "reset")}
              data-testid="day-leads-reset"
            >
              {saving === "reset" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Use standard roster
            </Button>
          )}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="ml-auto h-10 text-muted-foreground"
            onClick={() => setRosterOpen(true)}
            data-testid="day-leads-roster-link"
          >
            Edit standard roster
          </Button>
        </div>
      </form>
      {rosterDialog}
    </Card>
  );
}

function toDraft(leads: DayLeads): Record<DayLeadRole, string> {
  return { chef: leads.chef ?? "", fohManager: leads.fohManager ?? "" };
}

function normalizeDraft(
  draft: Record<DayLeadRole, string>
): Record<DayLeadRole, string> {
  return {
    chef: normalizeLeadName(draft.chef),
    fohManager: normalizeLeadName(draft.fohManager),
  };
}
