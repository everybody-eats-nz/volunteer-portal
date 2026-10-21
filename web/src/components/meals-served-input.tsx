"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { ServiceNightReportSkeleton } from "@/components/service-night-report-skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Ticket,
  Clock,
  Info,
  Plus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeNightDerived } from "@/lib/restaurant-stats";
import type { NightlyTarget } from "@/lib/budget-calculations";
import { NightlyTargetStrip } from "@/components/nightly-target-strip";
import {
  DAY_REPORT_TYPE_META,
  eventProfit,
  formatDuration,
  gstPortion,
  isDayReportType,
  openMinutes,
  summariseEventExpenses,
  summariseEventIncome,
  type DayReportType,
  type EventExpenseCategory,
  type EventIncomeCategory,
  type EventIncomeSource,
} from "@/lib/day-reports";
import {
  CountField,
  DerivedField,
  Field,
  HeroStat,
  MoneyField,
  SectionCard,
} from "@/components/day-report/fields";
import { ReportTypePicker } from "@/components/day-report/report-type-picker";
import {
  EventExpenseEditor,
  EventIncomeEditor,
  EventProfitStatement,
  isBlankLineDraft,
  newExpenseDraft,
  newIncomeDraft,
  type ExpenseDraft,
  type IncomeDraft,
} from "@/components/day-report/event-lines-editor";

interface MealsServedInputProps {
  date: string; // ISO date string (YYYY-MM-DD)
  location: string;
  /**
   * Whether any shifts run this day. Without shifts the report stays tucked
   * behind a one-line prompt (unless one is already recorded), since an empty
   * day is usually not a service; events and cafe days can still be recorded.
   */
  hasShifts?: boolean;
}

// Keys for every stored text/number field (mirrors the API / Prisma model).
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
  | "suggestedValue"
  | "protein"
  | "eventName"
  | "opensAt"
  | "closesAt";

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
  suggestedValue: "",
  protein: "",
  eventName: "",
  opensAt: "",
  closesAt: "",
};

const ALL_KEYS = Object.keys(EMPTY_FORM) as StatKey[];

// What each report asks for, which drives its "Logged x/y" progress. Event
// income and expense lines count as one more item each (see `filledCount`).
const REPORT_KEYS: Record<DayReportType, StatKey[]> = {
  SERVICE_NIGHT: [
    "mealsServed",
    "notes",
    "weather",
    "bookingsPax",
    "nonPayingCount",
    "vege",
    "takeaways",
    "eftposTransactions",
    "cash",
    "eftpos",
    "stripe",
    "suggestedValue",
    "protein",
  ],
  EVENT: ["eventName", "mealsServed", "notes"],
  CAFE: ["opensAt", "closesAt", "mealsServed", "cash", "eftpos", "notes"],
};

// Each report wears its own accent, so the type reads before any label does.
const ACCENT: Record<
  DayReportType,
  { header: string; eyebrow: string; icon: string; button: string }
> = {
  SERVICE_NIGHT: {
    header:
      "border-emerald-900/10 from-muted/55 dark:border-emerald-400/10 dark:from-emerald-950/30",
    eyebrow: "text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    button:
      "bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500",
  },
  EVENT: {
    header:
      "border-violet-900/10 from-violet-100/60 dark:border-violet-400/10 dark:from-violet-950/30",
    eyebrow: "text-violet-700 dark:text-violet-300",
    icon: "text-violet-600 dark:text-violet-300",
    button:
      "bg-violet-700 hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500",
  },
  CAFE: {
    header:
      "border-sky-900/10 from-sky-100/60 dark:border-sky-400/10 dark:from-sky-950/30",
    eyebrow: "text-sky-700 dark:text-sky-300",
    icon: "text-sky-600 dark:text-sky-300",
    button: "bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500",
  },
};

// What a save clears when the day changes type.
const CLEARED_ON_SWITCH: Record<DayReportType, string> = {
  SERVICE_NIGHT: "its koha and service stats",
  EVENT: "its event name, income and expenses",
  CAFE: "its cafe hours and takings",
};

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
const article = (type: DayReportType) =>
  type === "EVENT"
    ? "an event"
    : type === "CAFE"
      ? "a cafe day"
      : "a service night";

interface ApiIncomeLine {
  source: EventIncomeSource;
  category: EventIncomeCategory;
  description: string | null;
  amount: number;
  gstIncluded: boolean;
}

interface ApiExpenseLine {
  category: EventExpenseCategory;
  description: string | null;
  amount: number;
  gstIncluded: boolean;
}

// Saved amounts come back as numbers; the form edits them as "12.50".
const toDraftFields = <T extends { description: string | null; amount: number }>(
  line: T
) => ({ ...line, description: line.description ?? "", amount: line.amount.toFixed(2) });

export function MealsServedInput({
  date,
  location,
  hasShifts = true,
}: MealsServedInputProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [reportType, setReportType] = useState<DayReportType>("SERVICE_NIGHT");
  // The type as last saved, so switching can warn what a save would clear.
  const [savedType, setSavedType] = useState<DayReportType>("SERVICE_NIGHT");
  const [income, setIncome] = useState<IncomeDraft[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([]);
  // Each type's own figures, parked while another type is selected, so
  // flicking between types never moves cafe takings into koha (both use the
  // cash and EFTPOS columns) and switching back restores what was typed.
  const parked = useRef<
    Partial<
      Record<
        DayReportType,
        {
          fields: Partial<FormState>;
          income: IncomeDraft[];
          expenses: ExpenseDraft[];
        }
      >
    >
  >({});
  // On a day without shifts, the report opens only when asked for.
  const [started, setStarted] = useState(false);
  const [dayTheme, setDayTheme] = useState<string | null>(null);
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
  const [stripeSyncing, setStripeSyncing] = useState(false);
  // Pop-up / special-event venues take koha outside the per-restaurant Stripe
  // products, so the Stripe field stays manual-only (no Sync) for them.
  const [isPopupLocation, setIsPopupLocation] = useState(false);
  // Tonight's koha target (budget share, else the venue's standing target).
  const [target, setTarget] = useState<NightlyTarget | null>(null);

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
        ALL_KEYS.forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            next[key] = toFormString(data[key]);
            if (next[key] !== "") hasRecord = true;
          }
        });
        const type: DayReportType = isDayReportType(data.reportType)
          ? data.reportType
          : "SERVICE_NIGHT";
        const incomeLines: ApiIncomeLine[] = Array.isArray(data.income)
          ? data.income
          : [];
        const expenseLines: ApiExpenseLine[] = Array.isArray(data.expenses)
          ? data.expenses
          : [];
        // An event or cafe day is a record even before any figures go in.
        if (type !== "SERVICE_NIGHT") hasRecord = true;

        setForm(next);
        setReportType(type);
        setSavedType(type);
        setIncome(incomeLines.map((l) => newIncomeDraft(toDraftFields(l))));
        setExpenses(
          expenseLines.map((l) => newExpenseDraft(toDraftFields(l)))
        );
        setDayTheme(typeof data.dayTheme === "string" ? data.dayTheme : null);
        setHasExistingRecord(hasRecord);
        setNewVolunteers(
          typeof data.newVolunteers === "number" ? data.newVolunteers : null
        );
        setIsPopupLocation(data.isPopup === true);
        setTarget(data.target ?? null);
        if (typeof data.defaultMealsServed === "number") {
          setDefaultValue(data.defaultMealsServed);
        }

        // Auto-fill weather when none is recorded yet for a service night.
        if (type === "SERVICE_NIGHT" && next.weather === "" && hasShifts) {
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
  }, [date, location, applyWeather, hasShifts]);

  const changeType = (type: DayReportType) => {
    if (type === reportType) return;
    // Park the outgoing type's own figures, and bring back (or blank) the
    // incoming type's. Headcount and notes are shared and stay put.
    const shared = new Set<StatKey>(["mealsServed", "notes"]);
    const own = (t: DayReportType) =>
      REPORT_KEYS[t].filter((k) => !shared.has(k));
    parked.current[reportType] = {
      fields: Object.fromEntries(own(reportType).map((k) => [k, form[k]])),
      income,
      expenses,
    };
    const restored = parked.current[type];
    const next: FormState = { ...form };
    for (const k of own(type)) next[k] = restored?.fields[k] ?? "";
    // The day's theme is usually the event's name ("Rotary fundraiser dinner").
    if (type === "EVENT" && next.eventName.trim() === "" && dayTheme) {
      next.eventName = dayTheme;
    }
    setForm(next);
    setIncome(restored?.income ?? []);
    setExpenses(restored?.expenses ?? []);
    setReportType(type);
    setOpen(true);
    if (type === "SERVICE_NIGHT" && next.weather === "") {
      applyWeather(true);
    }
  };

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
  const incomeSummary = useMemo(
    () =>
      summariseEventIncome(
        income
          .filter((line) => num(line.amount) !== null)
          .map((line) => ({ ...line, amount: num(line.amount) ?? 0 }))
      ),
    [income]
  );
  const expenseSummary = useMemo(
    () =>
      summariseEventExpenses(
        expenses
          .filter((line) => num(line.amount) !== null)
          .map((line) => ({ ...line, amount: num(line.amount) ?? 0 }))
      ),
    [expenses]
  );
  const profit = eventProfit(incomeSummary, expenseSummary);
  const eftposTotal = num(form.eftpos);
  const customers = num(form.mealsServed);
  const cafeSales =
    num(form.cash) === null && eftposTotal === null
      ? null
      : (num(form.cash) ?? 0) + (eftposTotal ?? 0);
  // Cafe sales are taxable: the takings entered include 15% GST.
  const cafeGst = cafeSales === null ? null : gstPortion(cafeSales);
  const cafeSalesExGst =
    cafeSales === null || cafeGst === null ? null : cafeSales - cafeGst;
  const cafeMinutes = openMinutes(form.opensAt, form.closesAt);
  const hoursInvalid =
    form.opensAt !== "" && form.closesAt !== "" && cafeMinutes === null;

  const reportKeys = REPORT_KEYS[reportType];
  const isEvent = reportType === "EVENT";
  const incomeEntered =
    isEvent && income.some((line) => !isBlankLineDraft(line));
  const expensesEntered =
    isEvent && expenses.some((line) => !isBlankLineDraft(line));
  const filledCount =
    reportKeys.filter((k) => form[k].trim() !== "").length +
    (incomeEntered ? 1 : 0) +
    (expensesEntered ? 1 : 0);
  const totalCount = reportKeys.length + (isEvent ? 2 : 0);
  const completionPct = Math.round((filledCount / totalCount) * 100);
  // Marking a day as an event or cafe is worth saving on its own.
  const switching = hasExistingRecord && reportType !== savedType;
  // Marking a day as an event or cafe is worth saving on its own, and so is
  // switching a recorded day back to a (still blank) service night.
  const canSave =
    reportType !== "SERVICE_NIGHT" || filledCount > 0 || switching;
  const accent = ACCENT[reportType];
  const meta = DAY_REPORT_TYPE_META[reportType];

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

  // Pull tonight's Stripe koha for this location and fill the field. The figure
  // is non-destructive — the admin reviews it and saves with the rest of the form.
  const handleStripeSync = async () => {
    setStripeSyncing(true);
    try {
      const res = await fetch(
        `/api/admin/meals-served/stripe-sync?date=${date}&location=${encodeURIComponent(
          location
        )}`
      );
      if (res.status === 503) {
        toast.info("Stripe isn't connected yet", {
          description: "Add a Stripe API key to enable syncing.",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Couldn't sync with Stripe");
        return;
      }
      const data = await res.json();
      const total: number = typeof data.total === "number" ? data.total : 0;
      const count: number =
        typeof data.paymentCount === "number" ? data.paymentCount : 0;

      if (count === 0) {
        toast.info("No Stripe koha found for this night", {
          description: "Nothing to sync — enter manually if needed.",
        });
        return;
      }
      set("stripe", total.toFixed(2));
      toast.success(`Synced ${NZD.format(total)} from Stripe`, {
        description: `Across ${count} payment${
          count === 1 ? "" : "s"
        } — review and save.`,
      });
    } catch {
      toast.error("Couldn't sync with Stripe");
    } finally {
      setStripeSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Enter at least one stat before saving");
      return;
    }
    const incomeLines = income.filter((line) => !isBlankLineDraft(line));
    const expenseLines = expenses.filter((line) => !isBlankLineDraft(line));
    const missingAmount = (lines: { amount: string }[]) =>
      isEvent && lines.some((line) => num(line.amount) === null);
    for (const [kind, lines] of [
      ["income", incomeLines],
      ["expense", expenseLines],
    ] as const) {
      if (missingAmount(lines)) {
        setOpen(true);
        toast.error(`Enter an amount for every ${kind} line`, {
          description: "Or remove the lines you don't need.",
        });
        return;
      }
    }
    if (reportType === "CAFE" && hoursInvalid) {
      setOpen(true);
      toast.error("Closing time must be after opening time");
      return;
    }

    setLoading(true);
    try {
      // Send raw strings — the API's Zod schema coerces/validates them.
      const payload: Record<string, unknown> = { date, location, reportType };
      // Only this report's own fields: another type's leftovers (say, cafe
      // hours) must neither be saved nor fail validation out of sight.
      ALL_KEYS.forEach((key) => {
        payload[key] =
          !reportKeys.includes(key) || form[key].trim() === ""
            ? null
            : form[key].trim();
      });
      payload.income = isEvent
        ? incomeLines.map((line) => ({
            source: line.source,
            category: line.category,
            description: line.description.trim() || null,
            amount: line.amount.trim(),
            gstIncluded: line.gstIncluded,
          }))
        : [];
      payload.expenses = isEvent
        ? expenseLines.map((line) => ({
            category: line.category,
            description: line.description.trim() || null,
            amount: line.amount.trim(),
            gstIncluded: line.gstIncluded,
          }))
        : [];

      const response = await fetch("/api/admin/meals-served", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setHasExistingRecord(true);
        setSavedType(reportType);
        // Saving cleared every other type's figures on the server.
        parked.current = {};
        // The server keeps only this report's fields; mirror that so the
        // form never shows figures that weren't saved.
        setIncome(isEvent ? incomeLines : []);
        setExpenses(isEvent ? expenseLines : []);
        toast.success(`${meta.reportTitle} saved`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save report");
      }
    } catch (error) {
      console.error("Error saving day report:", error);
      toast.error("Failed to save report");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return hasShifts ? <ServiceNightReportSkeleton /> : null;
  }

  if (!hasShifts && !hasExistingRecord && !started) {
    return (
      <div className="mb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground"
          onClick={() => {
            setStarted(true);
            changeType("EVENT");
          }}
          data-testid="day-report-start"
        >
          <Plus className="h-4 w-4" />
          Record an event or cafe day
        </Button>
      </div>
    );
  }

  return (
    <Card
      className="mb-6 gap-0 overflow-hidden border-border/70 py-0 shadow-sm"
      data-testid="day-report"
      data-report-type={reportType}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* ── Report header (always visible) ─────────────────────── */}
        <header
          className={cn(
            "border-b bg-gradient-to-br via-card to-card px-6 py-5 dark:via-card dark:to-card",
            accent.header
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.18em]",
                  accent.eyebrow
                )}
                data-testid="day-report-title"
              >
                {meta.reportTitle}
              </p>
              <h2 className="mt-1 flex items-center gap-1.5 font-accent text-2xl font-semibold leading-none tracking-tight text-foreground">
                <MapPin className={cn("h-5 w-5 shrink-0", accent.icon)} />
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
                  <Button
                    type="button"
                    variant={open ? "ghost" : "outline"}
                    size="sm"
                    className="gap-1"
                  >
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
                      className={cn(
                        "h-4 w-4 transition-transform",
                        open && "rotate-180"
                      )}
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

          {/* What the day was: drives which report and which totals it feeds */}
          <div className="mt-4">
            <ReportTypePicker value={reportType} onChange={changeType} />
          </div>

          {switching && (
            <p
              role="status"
              className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
              data-testid="report-type-switch-note"
            >
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Saving records this day as {article(reportType)} and clears{" "}
                {CLEARED_ON_SWITCH[savedType]}.
              </span>
            </p>
          )}

          <div className="mt-5 space-y-2.5">
            {reportType === "SERVICE_NIGHT" && (
              <>
                {/* Koha against tonight's target. Pop-ups without one skip it. */}
                {(target || !isPopupLocation) && (
                  <NightlyTargetStrip
                    location={location}
                    target={target}
                    koha={derived.totalDonations}
                  />
                )}

                {/* Hero totals — the night's headline result, building live */}
                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <HeroStat
                    featured
                    label="Total koha"
                    value={
                      derived.totalDonations === null
                        ? "—"
                        : NZD.format(derived.totalDonations)
                    }
                  />
                  {/* Headcount is the figure the team wants at a glance */}
                  <HeroStat
                    label="Pax"
                    value={
                      customers === null
                        ? "—"
                        : customers.toLocaleString("en-NZ")
                    }
                  />
                  {/* EFTPOS is reconciled against Xero daily, so keep it on the summary */}
                  <HeroStat
                    label="EFTPOS"
                    value={eftposTotal === null ? "—" : NZD.format(eftposTotal)}
                  />
                  <HeroStat
                    label="$ per head"
                    value={
                      derived.perHead === null
                        ? "—"
                        : NZD.format(derived.perHead)
                    }
                  />
                </dl>
              </>
            )}

            {reportType === "EVENT" && (
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <HeroStat
                  featured
                  tone="violet"
                  label="Event income"
                  value={NZD.format(incomeSummary.total)}
                  hint="Incl. GST, not koha"
                  testId="event-hero-total"
                />
                <HeroStat
                  label="Expenses"
                  value={NZD.format(expenseSummary.total)}
                  hint="Incl. GST"
                  testId="event-hero-expenses"
                />
                <HeroStat
                  label={profit.profit < 0 ? "Loss" : "Profit"}
                  value={NZD.format(profit.profit)}
                  hint={`${NZD.format(profit.profitExGst)} excl. GST`}
                  testId="event-hero-profit"
                />
                <HeroStat
                  label="Pax"
                  value={
                    customers === null ? "—" : customers.toLocaleString("en-NZ")
                  }
                  hint={
                    customers && incomeSummary.total > 0
                      ? `${NZD.format(incomeSummary.total / customers)} per head`
                      : undefined
                  }
                />
              </dl>
            )}

            {reportType === "CAFE" && (
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <HeroStat
                  featured
                  tone="sky"
                  label="Cafe takings"
                  value={cafeSales === null ? "—" : NZD.format(cafeSales)}
                  hint="Incl. GST, not koha"
                  testId="cafe-hero-total"
                />
                <HeroStat
                  label="Excl. GST"
                  value={
                    cafeSalesExGst === null ? "—" : NZD.format(cafeSalesExGst)
                  }
                  hint={
                    cafeGst === null
                      ? undefined
                      : `${NZD.format(cafeGst)} GST`
                  }
                  testId="cafe-hero-ex-gst"
                />
                <HeroStat
                  label="Customers"
                  value={
                    customers === null ? "—" : customers.toLocaleString("en-NZ")
                  }
                  hint={
                    cafeMinutes === null
                      ? undefined
                      : `Open ${formatDuration(cafeMinutes)}`
                  }
                />
                <HeroStat
                  label="$ per customer"
                  value={
                    customers && cafeSales !== null
                      ? NZD.format(cafeSales / customers)
                      : "—"
                  }
                />
              </dl>
            )}
          </div>
        </header>

        {/* Notes — always visible; jotted during service, not just after */}
        <div className="border-b bg-card px-6 py-4">
          <Field htmlFor="notes" label="Notes">
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={
                reportType === "SERVICE_NIGHT"
                  ? "Jot anything during or after service…"
                  : "Jot anything during or after the day…"
              }
              rows={2}
            />
          </Field>
        </div>

        <CollapsibleContent>
          {/* ── Report body ────────────────────────────────────────── */}
          <div className="space-y-5 px-6 py-6">
            {reportType === "SERVICE_NIGHT" && (
              <ServiceNightBody
                form={form}
                set={set}
                defaultValue={defaultValue}
                newVolunteers={newVolunteers}
                weatherLoading={weatherLoading}
                onWeather={() => applyWeather(false)}
                stripeSyncing={stripeSyncing}
                onStripeSync={isPopupLocation ? undefined : handleStripeSync}
                derived={derived}
              />
            )}

            {reportType === "EVENT" && (
              <>
                <SectionCard icon={Ticket} title="The event" tone="violet">
                  <div className="sm:col-span-2">
                    <Field
                      htmlFor="eventName"
                      label="Event name"
                      action={
                        dayTheme && form.eventName.trim() !== dayTheme ? (
                          <button
                            type="button"
                            onClick={() => set("eventName", dayTheme)}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300 dark:hover:bg-violet-900/40"
                          >
                            Use day theme
                          </button>
                        ) : undefined
                      }
                    >
                      <Input
                        id="eventName"
                        value={form.eventName}
                        maxLength={120}
                        onChange={(e) => set("eventName", e.target.value)}
                        placeholder="e.g. Matariki fundraiser dinner"
                        className="h-11 text-base font-medium"
                      />
                    </Field>
                  </div>
                  <CountField
                    id="mealsServed"
                    label="Guests (pax)"
                    value={form.mealsServed}
                    onChange={(v) => set("mealsServed", v)}
                    hint="Counts towards people served."
                  />
                  <NewVolunteersField value={newVolunteers} />
                </SectionCard>

                <SectionCard
                  icon={HandCoins}
                  title="Income"
                  tone="violet"
                  action={
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                      {NZD.format(incomeSummary.total)}
                    </span>
                  }
                >
                  <EventIncomeEditor
                    lines={income}
                    onChange={setIncome}
                    summary={incomeSummary}
                  />
                </SectionCard>

                <SectionCard
                  icon={Receipt}
                  title="Expenses"
                  tone="violet"
                  action={
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
                      {NZD.format(expenseSummary.total)}
                    </span>
                  }
                >
                  <EventExpenseEditor
                    lines={expenses}
                    onChange={setExpenses}
                    summary={expenseSummary}
                  />
                </SectionCard>

                {(income.length > 0 || expenses.length > 0) && (
                  <EventProfitStatement
                    income={incomeSummary}
                    expenses={expenseSummary}
                    profit={profit}
                  />
                )}
              </>
            )}

            {reportType === "CAFE" && (
              <>
                <SectionCard icon={Clock} title="Hours & customers" tone="sky">
                  <Field htmlFor="opensAt" label="Opened">
                    <Input
                      id="opensAt"
                      type="time"
                      step={300}
                      value={form.opensAt}
                      onChange={(e) => set("opensAt", e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    htmlFor="closesAt"
                    label="Closed"
                    hint={
                      hoursInvalid
                        ? "Closing time must be after opening time."
                        : undefined
                    }
                  >
                    <Input
                      id="closesAt"
                      type="time"
                      step={300}
                      value={form.closesAt}
                      onChange={(e) => set("closesAt", e.target.value)}
                      aria-invalid={hoursInvalid || undefined}
                      className="tabular-nums"
                    />
                  </Field>
                  <CountField
                    id="mealsServed"
                    label="Customers served"
                    value={form.mealsServed}
                    onChange={(v) => set("mealsServed", v)}
                    hint="Counts towards people served."
                  />
                  <NewVolunteersField value={newVolunteers} />
                </SectionCard>

                <SectionCard
                  icon={HandCoins}
                  title="Takings"
                  tone="sky"
                  action={
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                      {cafeSales === null ? "$0" : NZD.format(cafeSales)}
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
                    label="EFTPOS"
                    value={form.eftpos}
                    onChange={(v) => set("eftpos", v)}
                  />
                  {cafeSales !== null && (
                    <dl
                      className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 rounded-xl bg-muted/40 px-4 py-3.5 text-sm sm:col-start-2"
                      data-testid="cafe-takings-summary"
                    >
                      <dt className="text-muted-foreground">Total incl. GST</dt>
                      <dd className="text-right font-semibold tabular-nums">
                        {NZD.format(cafeSales)}
                      </dd>
                      <dt className="text-muted-foreground">GST</dt>
                      <dd className="text-right tabular-nums" data-testid="cafe-gst">
                        {NZD.format(cafeGst ?? 0)}
                      </dd>
                      <dt className="text-muted-foreground">Total excl. GST</dt>
                      <dd
                        className="text-right tabular-nums"
                        data-testid="cafe-total-ex-gst"
                      >
                        {NZD.format(cafeSalesExGst ?? 0)}
                      </dd>
                    </dl>
                  )}
                  <p className="text-[11px] text-muted-foreground sm:col-span-2">
                    Enter takings as taken, including GST. Cafe takings are
                    kept out of koha totals. Cash still shows in cash
                    reconciliation, labelled as a cafe day.
                  </p>
                </SectionCard>
              </>
            )}
          </div>
        </CollapsibleContent>

        {/* ── Footer (always visible — saves notes + stats) ────────── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {hasExistingRecord
              ? "Update the figures any time."
              : reportType === "SERVICE_NIGHT"
                ? "Jot notes during service — expand to record the full stats."
                : `Save to record this day as ${article(reportType)}.`}
          </p>
          <Button
            onClick={handleSave}
            disabled={loading || !canSave}
            className={cn("text-white", accent.button)}
            data-testid="day-report-save"
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

function NewVolunteersField({ value }: { value: number | null }) {
  return (
    <Field
      htmlFor="newVolunteers"
      label="New volunteers"
      hint="Counted automatically from confirmed attendance."
    >
      <div
        id="newVolunteers"
        className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground"
      >
        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
        {value === null ? "—" : value}
      </div>
    </Field>
  );
}

function ServiceNightBody({
  form,
  set,
  defaultValue,
  newVolunteers,
  weatherLoading,
  onWeather,
  stripeSyncing,
  onStripeSync,
  derived,
}: {
  form: FormState;
  set: (key: StatKey, value: string) => void;
  defaultValue: number;
  newVolunteers: number | null;
  weatherLoading: boolean;
  onWeather: () => void;
  stripeSyncing: boolean;
  onStripeSync?: () => void;
  derived: ReturnType<typeof computeNightDerived>;
}) {
  return (
    <>
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
        <NewVolunteersField value={newVolunteers} />

        {/* Weather — auto-pulled from Open-Meteo, still editable */}
        <Field
          htmlFor="weather"
          label="Weather"
          action={
            <button
              type="button"
              onClick={onWeather}
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
            <SelectTrigger id="protein" size="md" className="w-full">
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
            onStripeSync ? (
              <button
                type="button"
                onClick={onStripeSync}
                disabled={stripeSyncing}
                aria-label="Sync Stripe koha for this night"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100/70 disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                {stripeSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {stripeSyncing ? "Syncing…" : "Sync"}
              </button>
            ) : undefined
          }
        />
        <MoneyField
          id="suggestedValue"
          label="Suggested value"
          value={form.suggestedValue}
          onChange={(v) => set("suggestedValue", v)}
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
        />

        {/* Derived ratios — calculated, not entered */}
        <DerivedField
          id="perPaying"
          label="Per paying customer"
          value={
            derived.perPaying === null ? "—" : NZD.format(derived.perPaying)
          }
          hint="Koha divided by paying customers."
        />
        <DerivedField
          id="nonPayingRatio"
          label="Non-paying"
          value={
            derived.nonPayingRatio === null
              ? "—"
              : `${Math.round(derived.nonPayingRatio * 100)}%`
          }
          hint="Share of customers served."
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
    </>
  );
}
