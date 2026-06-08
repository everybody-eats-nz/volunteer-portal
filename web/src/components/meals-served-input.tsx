"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Save,
  Loader2,
  HandCoins,
  RefreshCw,
  Users,
  UserPlus,
  UtensilsCrossed,
  CalendarDays,
  MapPin,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeNightDerived } from "@/lib/restaurant-stats";

interface MealsServedInputProps {
  date: string; // ISO date string (YYYY-MM-DD)
  location: string;
}

// Keys for every stored stat field (mirrors the API / Prisma model).
type StatKey =
  | "mealsServed"
  | "notes"
  | "weather"
  | "bookingsPax"
  | "nonPayingCount"
  | "vege"
  | "takeaways"
  | "eftposTransactions"
  | "cash"
  | "eftpos"
  | "stripe"
  | "protein";

type FormState = Record<StatKey, string>; // all held as strings; "" === empty

const EMPTY_FORM: FormState = {
  mealsServed: "",
  notes: "",
  weather: "",
  bookingsPax: "",
  nonPayingCount: "",
  vege: "",
  takeaways: "",
  eftposTransactions: "",
  cash: "",
  eftpos: "",
  stripe: "",
  protein: "",
};

const FILLABLE_KEYS = Object.keys(EMPTY_FORM) as StatKey[];

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

const PROTEIN_OPTIONS = [
  "Beef",
  "Chicken",
  "Pork",
  "Lamb",
  "Ham",
  "Fish",
  "Vegetarian",
  "Other",
] as const;

const toFormString = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const num = (v: string | undefined | null): number | null => {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function MealsServedInput({ date, location }: MealsServedInputProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [defaultValue, setDefaultValue] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  // Collapsed by default so the report doesn't dominate the shifts page;
  // the summary header + hero totals stay visible, the form expands on demand.
  const [open, setOpen] = useState(false);
  // New volunteers are derived from attendance (read-only), not entered.
  const [newVolunteers, setNewVolunteers] = useState<number | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const set = (key: StatKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Pull the day's weather from Open-Meteo and fill the field. `silent` skips
  // toasts (used for the automatic fetch when no weather is recorded yet).
  const applyWeather = useCallback(
    async (silent: boolean) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(
          `/api/admin/weather?date=${date}&location=${encodeURIComponent(
            location
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.weather) {
            setForm((prev) => ({ ...prev, weather: data.weather }));
            if (!silent) toast.success(`Weather updated: ${data.weather}`);
            return;
          }
        }
        if (!silent) toast.error("Couldn't fetch weather for this night");
      } catch {
        if (!silent) toast.error("Couldn't fetch weather");
      } finally {
        setWeatherLoading(false);
      }
    },
    [date, location]
  );

  // Fetch existing record for this date + location
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setFetching(true);
      try {
        const response = await fetch(
          `/api/admin/meals-served?date=${date}&location=${encodeURIComponent(
            location
          )}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;

        const next: FormState = { ...EMPTY_FORM };
        let hasRecord = false;
        FILLABLE_KEYS.forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            next[key] = toFormString(data[key]);
            if (next[key] !== "") hasRecord = true;
          }
        });

        setForm(next);
        setHasExistingRecord(hasRecord);
        setNewVolunteers(
          typeof data.newVolunteers === "number" ? data.newVolunteers : null
        );
        if (typeof data.defaultMealsServed === "number") {
          setDefaultValue(data.defaultMealsServed);
        }

        // Auto-fill weather when none is recorded yet for this night.
        if (next.weather === "") {
          applyWeather(true);
        }
      } catch (error) {
        console.error("Error fetching service-night stats:", error);
      } finally {
        if (active) setFetching(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [date, location, applyWeather]);

  // Live derived figures (mirror the spreadsheet formulas)
  const derived = useMemo(
    () =>
      computeNightDerived({
        customers: num(form.mealsServed),
        nonPayingCount: num(form.nonPayingCount),
        cash: num(form.cash),
        eftpos: num(form.eftpos),
        stripe: num(form.stripe),
      }),
    [form.mealsServed, form.nonPayingCount, form.cash, form.eftpos, form.stripe]
  );

  const filledCount = FILLABLE_KEYS.filter(
    (k) => form[k].trim() !== ""
  ).length;
  const totalCount = FILLABLE_KEYS.length;
  const completionPct = Math.round((filledCount / totalCount) * 100);
  const canSave = filledCount > 0;

  const dateLabel = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return new Intl.DateTimeFormat("en-NZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }, [date]);

  // Placeholder for the future Stripe API integration — the UI is in place but
  // the figure is still entered manually until the backend sync is built.
  const handleStripeSync = () => {
    toast.info("Stripe sync is coming soon", {
      description: "For now, enter tonight's Stripe total manually.",
    });
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Enter at least one stat before saving");
      return;
    }

    setLoading(true);
    try {
      // Send raw strings — the API's Zod schema coerces/validates them.
      const payload: Record<string, unknown> = { date, location };
      FILLABLE_KEYS.forEach((key) => {
        payload[key] = form[key].trim() === "" ? null : form[key].trim();
      });

      const response = await fetch("/api/admin/meals-served", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setHasExistingRecord(true);
        toast.success("Service-night report saved");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save report");
      }
    } catch (error) {
      console.error("Error saving service-night stats:", error);
      toast.error("Failed to save report");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card className="mb-6 gap-0 overflow-hidden py-0">
        <div className="border-b bg-muted/40 px-6 py-5">
          <div className="h-3 w-32 animate-pulse rounded bg-muted-foreground/20" />
          <div className="mt-2 h-6 w-56 animate-pulse rounded bg-muted-foreground/20" />
        </div>
        <div className="flex items-center justify-center px-6 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 gap-0 overflow-hidden border-border/70 py-0 shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* ── Report header (always visible) ─────────────────────── */}
        <header className="border-b border-emerald-900/10 bg-gradient-to-br from-[var(--ee-muted)]/55 via-card to-card px-6 py-5 dark:border-emerald-400/10 dark:from-emerald-950/30 dark:via-card dark:to-card">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Service Night Report
              </p>
              <h2 className="mt-1 flex items-center gap-1.5 font-accent text-2xl font-semibold leading-none tracking-tight text-foreground">
                <MapPin className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <em>{location}</em>
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {dateLabel}
              </p>
            </div>

            <div className="flex flex-col items-start gap-2.5 sm:items-end">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    hasExistingRecord
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  )}
                >
                  {hasExistingRecord ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Recorded
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" /> Not recorded yet
                    </>
                  )}
                </Badge>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant={open ? "ghost" : "outline"} size="sm" className="gap-1">
                    {open ? (
                      "Hide"
                    ) : hasExistingRecord ? (
                      <>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </>
                    ) : (
                      "Record stats"
                    )}
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="w-48">
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Logged</span>
                  <span className="tabular-nums">
                    {filledCount}/{totalCount}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/10 dark:bg-emerald-400/15">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out dark:bg-emerald-400"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

        {/* Hero totals — the night's headline result, building live */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <HeroStat
            featured
            label="Total koha"
            value={
              derived.totalDonations === null
                ? "—"
                : NZD.format(derived.totalDonations)
            }
          />
          <HeroStat
            label="$ per head"
            value={derived.perHead === null ? "—" : NZD.format(derived.perHead)}
          />
          <HeroStat
            label="Per paying"
            value={
              derived.perPaying === null ? "—" : NZD.format(derived.perPaying)
            }
          />
          <HeroStat
            label="Non-paying"
            value={
              derived.nonPayingRatio === null
                ? "—"
                : `${Math.round(derived.nonPayingRatio * 100)}%`
            }
          />
        </div>
        </header>

        {/* Notes — always visible; jotted during service, not just after */}
        <div className="border-b bg-card px-6 py-4">
          <Field htmlFor="notes" label="Notes">
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Jot anything during or after service…"
              rows={2}
            />
          </Field>
        </div>

        <CollapsibleContent>
          {/* ── Report body ────────────────────────────────────────── */}
          <div className="space-y-5 px-6 py-6">
        {/* Attendance & service */}
        <SectionCard icon={Users} title="Attendance & service" tone="emerald">
          {/* Headline count — featured, spans the row */}
          <div className="sm:col-span-2">
            <Field htmlFor="mealsServed" label="Customers served">
              <Input
                id="mealsServed"
                type="number"
                inputMode="numeric"
                min="0"
                value={form.mealsServed}
                onChange={(e) => set("mealsServed", e.target.value)}
                placeholder={`e.g. ${defaultValue}`}
                className="h-11 max-w-xs text-lg font-semibold tabular-nums"
              />
            </Field>
            <p className="mt-1 text-[11px] text-muted-foreground">
              People served tonight — the headline count.
            </p>
          </div>

          <CountField
            id="bookingsPax"
            label="Bookings (pax)"
            value={form.bookingsPax}
            onChange={(v) => set("bookingsPax", v)}
          />

          {/* New volunteers — derived from confirmed attendance, read-only */}
          <Field
            htmlFor="newVolunteers"
            label="New volunteers"
            hint="Counted automatically from confirmed attendance."
          >
            <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              {newVolunteers === null ? "—" : newVolunteers}
            </div>
          </Field>

          {/* Weather — auto-pulled from Open-Meteo, still editable */}
          <Field
            htmlFor="weather"
            label="Weather"
            action={
              <button
                type="button"
                onClick={() => applyWeather(false)}
                disabled={weatherLoading}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100/70 disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                {weatherLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {weatherLoading ? "Fetching…" : "Get weather"}
              </button>
            }
          >
            <Input
              id="weather"
              type="text"
              value={form.weather}
              onChange={(e) => set("weather", e.target.value)}
              placeholder="e.g. Overcast, 15°C"
            />
          </Field>

          <Field htmlFor="protein" label="Protein">
            <Select
              value={form.protein || undefined}
              onValueChange={(v) => set("protein", v)}
            >
              <SelectTrigger id="protein" className="h-9 w-full">
                <SelectValue placeholder="Select protein" />
              </SelectTrigger>
              <SelectContent>
                {PROTEIN_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </SectionCard>

        {/* Koha */}
        <SectionCard
          icon={HandCoins}
          title="Koha collected"
          tone="amber"
          action={
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              {derived.totalDonations === null
                ? "$0"
                : NZD.format(derived.totalDonations)}
            </span>
          }
        >
          <MoneyField
            id="cash"
            label="Cash"
            value={form.cash}
            onChange={(v) => set("cash", v)}
          />
          <MoneyField
            id="eftpos"
            label="Eftpos"
            value={form.eftpos}
            onChange={(v) => set("eftpos", v)}
          />
          <MoneyField
            id="stripe"
            label="Stripe"
            value={form.stripe}
            onChange={(v) => set("stripe", v)}
            action={
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px] font-medium uppercase tracking-wide"
                >
                  Soon
                </Badge>
                <button
                  type="button"
                  onClick={handleStripeSync}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </button>
              </div>
            }
          />
          <CountField
            id="eftposTransactions"
            label="Eftpos transactions"
            value={form.eftposTransactions}
            onChange={(v) => set("eftposTransactions", v)}
          />
          <CountField
            id="nonPayingCount"
            label="Non-paying customers"
            value={form.nonPayingCount}
            onChange={(v) => set("nonPayingCount", v)}
            hint={
              derived.nonPayingRatio === null
                ? "Ratio is calculated from customers served."
                : `${Math.round(derived.nonPayingRatio * 100)}% of customers served`
            }
          />
        </SectionCard>

            {/* Meals */}
            <SectionCard icon={UtensilsCrossed} title="Meals" tone="violet">
              <CountField
                id="takeaways"
                label="Takeaways"
                value={form.takeaways}
                onChange={(v) => set("takeaways", v)}
              />
              <CountField
                id="vege"
                label="Vege meals"
                value={form.vege}
                onChange={(v) => set("vege", v)}
              />
            </SectionCard>
          </div>
        </CollapsibleContent>

        {/* ── Footer (always visible — saves notes + stats) ────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {hasExistingRecord
              ? "Update tonight's figures any time."
              : "Jot notes during service — expand to record the full stats."}
          </p>
          <Button
            onClick={handleSave}
            disabled={loading || !canSave}
            className="bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {hasExistingRecord ? "Update report" : "Save report"}
              </>
            )}
          </Button>
        </footer>
      </Collapsible>
    </Card>
  );
}

// ── Presentational helpers (module scope so identity is stable) ──────

function HeroStat({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5",
        featured
          ? "border-amber-300/70 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30"
          : "border-border/70 bg-card/70"
      )}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "font-accent font-semibold tabular-nums leading-tight",
          featured
            ? "text-2xl text-amber-700 dark:text-amber-300"
            : "text-xl text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}

const TONES = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
} as const;

function SectionCard({
  icon: Icon,
  title,
  tone,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: keyof typeof TONES;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              TONES[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h3>
        {action}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  action,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">
          {label}
        </Label>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CountField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field htmlFor={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    </Field>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  action,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  action?: React.ReactNode;
}) {
  return (
    <Field htmlFor={id} label={label} action={action}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="pl-7 tabular-nums"
        />
      </div>
    </Field>
  );
}
