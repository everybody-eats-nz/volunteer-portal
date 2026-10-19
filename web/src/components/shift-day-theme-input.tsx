"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SHIFT_DAY_THEME_MAX_LENGTH,
  normalizeTheme,
} from "@/lib/shift-day-themes";

interface ShiftDayThemeInputProps {
  date: string; // YYYY-MM-DD (NZ day)
  location: string;
  /** The saved theme, or null when the day has none. */
  initialTheme: string | null;
}

/**
 * Admin editor for the day's theme ("Christmas Lunch", "Pasta Night"),
 * which volunteers see beside the date on the shift calendar.
 */
export function ShiftDayThemeInput({
  date,
  location,
  initialTheme,
}: ShiftDayThemeInputProps) {
  const router = useRouter();
  const [savedTheme, setSavedTheme] = useState(initialTheme ?? "");
  const [value, setValue] = useState(initialTheme ?? "");
  const [saving, setSaving] = useState<"save" | "remove" | null>(null);
  const [, startTransition] = useTransition();

  const trimmed = normalizeTheme(value);
  const isDirty = trimmed !== savedTheme;
  const remaining = SHIFT_DAY_THEME_MAX_LENGTH - value.length;
  const inputId = `day-theme-${date}`;

  const persist = async (theme: string, action: "save" | "remove") => {
    setSaving(action);
    try {
      const res = await fetch("/api/admin/shift-day-themes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, location, theme }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Couldn't save the day theme. Try again.");
        return;
      }
      const next: string = data?.theme ?? "";
      setSavedTheme(next);
      setValue(next);
      toast.success(next ? "Day theme saved" : "Day theme removed");
      startTransition(() => router.refresh());
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card
      className="@container mb-6 gap-0 border-border/70 px-5 py-4 shadow-sm"
      data-testid="shift-day-theme-card"
    >
      <form
        className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty && !saving) persist(trimmed, trimmed ? "save" : "remove");
        }}
      >
        <div className="flex min-w-0 items-center gap-3 @3xl:w-72 @3xl:shrink-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <Label htmlFor={inputId} className="text-sm font-semibold">
              Day theme
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shown to volunteers beside the date on the shift calendar.
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
              placeholder="e.g. Christmas Lunch or Pasta Night"
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
            {savedTheme && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 text-muted-foreground hover:text-destructive"
                disabled={saving !== null}
                onClick={() => persist("", "remove")}
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
    </Card>
  );
}
