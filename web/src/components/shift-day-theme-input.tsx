"use client";

import { useState, useTransition } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { useRouter } from "next/navigation";
import {
  DoorClosed,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SHIFT_DAY_THEME_MAX_LENGTH,
  normalizeTheme,
  type ShiftDayTheme,
} from "@/lib/shift-day-themes";

interface ShiftDayThemeInputProps {
  date: string; // YYYY-MM-DD (NZ day)
  location: string;
  /** What's saved for the day, or null when it has nothing. */
  initial: ShiftDayTheme | null;
  /** Shifts on the day - a closed day that still has some gets a warning. */
  shiftCount: number;
}

const EMPTY: ShiftDayTheme = { theme: "", closed: false };

/**
 * Admin editor for what volunteers see beside the date on the shift calendar:
 * a theme ("Christmas Lunch", "Pasta Night"), or that the restaurant is
 * closed and why ("Labour Day weekend"). Both are rare, so it stays
 * collapsed - "Add day theme" / "Mark as closed" buttons, or a one-line
 * summary once something is set - until an admin opens it.
 */
export function ShiftDayThemeInput({
  date,
  location,
  initial,
  shiftCount,
}: ShiftDayThemeInputProps) {
  const router = useRouter();
  const [saved, setSaved] = useState<ShiftDayTheme>(initial ?? EMPTY);
  const [value, setValue] = useState(initial?.theme ?? "");
  const [closed, setClosed] = useState(initial?.closed ?? false);
  const [saving, setSaving] = useState<"save" | "remove" | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const hasSaved = saved.closed || saved.theme !== "";
  const trimmed = normalizeTheme(value);
  const isDirty = trimmed !== saved.theme || closed !== saved.closed;
  // An open day with no theme has nothing to keep, so saving removes it.
  const savesAsRemove = !closed && trimmed === "";
  const remaining = SHIFT_DAY_THEME_MAX_LENGTH - value.length;
  const inputId = `day-theme-${date}`;

  const persist = async (next: ShiftDayTheme, action: "save" | "remove") => {
    setSaving(action);
    try {
      const res = await fetch("/api/admin/shift-day-themes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, location, ...next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Couldn't save the day. Try again.");
        return;
      }
      const result: ShiftDayTheme = {
        theme: data?.theme ?? "",
        closed: data?.closed === true,
      };
      setSaved(result);
      setValue(result.theme);
      setClosed(result.closed);
      setOpen(false);
      toast.success(
        result.closed
          ? "Day marked as closed"
          : result.theme
            ? "Day theme saved"
            : saved.closed
              ? "Closure removed"
              : "Day theme removed"
      );
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to save shift day theme:", error);
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  const openEditor = (asClosed: boolean) => {
    setClosed(asClosed);
    setOpen(true);
  };

  const cancel = () => {
    setValue(saved.theme);
    setClosed(saved.closed);
    setOpen(false);
  };

  const shiftWarning =
    closed && shiftCount > 0 ? (
      <p
        className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"
        data-testid="shift-day-closed-shifts-warning"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {shiftCount === 1
            ? "This day still has 1 shift, and volunteers can still sign up for it."
            : `This day still has ${shiftCount} shifts, and volunteers can still sign up for them.`}{" "}
          Cancel them if the restaurant is closed.
        </span>
      </p>
    ) : null;

  if (!open) {
    if (!hasSaved) {
      return (
        <div className="mb-6 flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1.5 text-muted-foreground"
            onClick={() => openEditor(false)}
            data-testid="shift-day-theme-add"
          >
            <Plus className="h-4 w-4" />
            Add day theme
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => openEditor(true)}
            data-testid="shift-day-closed-add"
          >
            <DoorClosed className="h-4 w-4" />
            Mark as closed
          </Button>
        </div>
      );
    }

    return (
      <div className="mb-6 space-y-2">
        <div
          className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-2 shadow-sm"
          data-testid="shift-day-theme-summary"
        >
          {saved.closed ? (
            <>
              <DoorClosed className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
              <span className="shrink-0 rounded-md bg-slate-200/80 px-2 py-0.5 text-sm font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                Closed
              </span>
              {saved.theme ? (
                <span className="min-w-0 truncate font-accent text-sm italic text-foreground/80">
                  {saved.theme}
                </span>
              ) : (
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  No reason given
                </span>
              )}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="shrink-0 text-sm text-muted-foreground">Day theme</span>
              <span className="min-w-0 truncate rounded-md bg-amber-100 px-2 py-0.5 font-accent text-sm italic text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                {saved.theme}
              </span>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0 gap-1.5 text-muted-foreground"
            onClick={() => openEditor(saved.closed)}
            data-testid="shift-day-theme-edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
        {shiftWarning && <div className="px-1">{shiftWarning}</div>}
      </div>
    );
  }

  return (
    <Card
      className="@container mb-6 gap-4 border-border/70 px-5 py-4 shadow-sm"
      data-testid="shift-day-theme-card"
    >
      <form
        className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty && !saving) {
            persist(
              { theme: trimmed, closed },
              savesAsRemove ? "remove" : "save"
            );
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !saving) cancel();
        }}
      >
        <div className="flex min-w-0 flex-col gap-3 @3xl:w-72 @3xl:shrink-0">
          {/* What kind of day this is. The text below means something
              different for each, so it's a choice, not a checkbox. Styled
              like the day report's type picker above it. */}
          <RadioGroupPrimitive.Root
            value={closed ? "closed" : "theme"}
            onValueChange={(v) => setClosed(v === "closed")}
            disabled={saving !== null}
            aria-label="What should volunteers see?"
            className="inline-flex w-fit rounded-xl border border-border/80 bg-card/80 p-1 shadow-xs"
          >
            {(
              [
                {
                  value: "theme",
                  label: "Day theme",
                  Icon: Sparkles,
                  selected:
                    "data-[state=checked]:bg-amber-700 data-[state=checked]:text-white dark:data-[state=checked]:bg-amber-500 dark:data-[state=checked]:text-amber-950",
                },
                {
                  value: "closed",
                  label: "Closed",
                  Icon: DoorClosed,
                  selected:
                    "data-[state=checked]:bg-slate-700 data-[state=checked]:text-white dark:data-[state=checked]:bg-slate-200 dark:data-[state=checked]:text-slate-900",
                },
              ] as const
            ).map(({ value: option, label, Icon, selected }) => (
              <RadioGroupPrimitive.Item
                key={option}
                value={option}
                className={cn(
                  "flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors data-[state=unchecked]:hover:bg-muted data-[state=unchecked]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed data-[state=checked]:shadow-sm",
                  selected
                )}
                data-testid={`shift-day-type-${option}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </RadioGroupPrimitive.Item>
            ))}
          </RadioGroupPrimitive.Root>
          <div className="min-w-0">
            <Label htmlFor={inputId} className="text-sm font-semibold">
              {closed ? "Reason (optional)" : "Day theme"}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {closed
                ? "Volunteers see this day as closed on the shift calendar, with your reason."
                : "Shown to volunteers beside the date on the shift calendar."}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 @md:flex-row @md:items-center">
          <div className="relative flex-1">
            <Input
              id={inputId}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={SHIFT_DAY_THEME_MAX_LENGTH}
              placeholder={
                closed
                  ? "e.g. Labour Day weekend"
                  : "e.g. Christmas Lunch or Pasta Night"
              }
              autoFocus
              className="h-10 pr-12"
              data-testid="shift-day-theme-input"
            />
            {/* Characters left, once the limit is in sight */}
            {remaining <= 20 && (
              <span
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums",
                  remaining === 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
                aria-hidden
              >
                {remaining}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              className="h-10 min-w-20"
              disabled={!isDirty || saving !== null}
              data-testid="shift-day-theme-save"
            >
              {saving === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 text-muted-foreground"
              disabled={saving !== null}
              onClick={cancel}
              data-testid="shift-day-theme-cancel"
            >
              Cancel
            </Button>
            {hasSaved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 text-muted-foreground hover:text-destructive"
                disabled={saving !== null}
                onClick={() => persist(EMPTY, "remove")}
                data-testid="shift-day-theme-remove"
              >
                {saving === "remove" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Remove
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
      {shiftWarning}
    </Card>
  );
}
