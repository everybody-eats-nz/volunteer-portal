"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowUpRight,
  CalendarRange,
  Coffee,
  Loader2,
  MapPin,
  Ticket,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { budgetYearLabel } from "@/lib/budget-calculations";
import {
  EVENT_EXPENSE_CATEGORY_LABEL,
  EVENT_INCOME_CATEGORY_LABEL,
  EVENT_INCOME_SOURCE_LABEL,
  formatDuration,
  formatTimeOfDay,
} from "@/lib/day-reports";
import {
  CATEGORY_KEYS,
  EXPENSE_CATEGORY_KEYS,
  SOURCE_KEYS,
  rankedShares,
  type CafeReport,
  type EventsReport,
} from "@/lib/events-cafe-report";

type View = "events" | "cafe";

interface Props {
  events: EventsReport;
  cafe: CafeReport;
  years: number[];
  period: number | "all";
  location: string; // "all" or a location name
  locations: string[];
  view: View;
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});
const money = (n: number) => NZD.format(n);

const keyToDate = (key: string) => new Date(`${key}T00:00:00`);

function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n.toLocaleString("en-NZ")} ${n === 1 ? word : pluralWord}`;
}

function reportHref(date: string, location: string) {
  return `/admin/shifts?${new URLSearchParams({ date, location })}`;
}

export function EventsCafeClient({
  events,
  cafe,
  years,
  period,
  location,
  locations,
  view,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (patch: {
    year?: string;
    location?: string;
    view?: View;
  }) => {
    const params = new URLSearchParams({
      year: patch.year ?? String(period),
      location: patch.location ?? location,
      view: patch.view ?? view,
    });
    startTransition(() => {
      router.push(`/admin/analytics/events?${params}`, { scroll: false });
    });
  };

  const periodLabel =
    period === "all"
      ? "all time"
      : `the ${budgetYearLabel(period)} financial year`;
  const placeLabel = location === "all" ? "all restaurants" : location;

  return (
    <div className="space-y-5 pb-12">
      {/* Controls */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm"
        data-testid="events-cafe-filters"
      >
        <Select
          value={location}
          onValueChange={(v) => navigate({ location: v })}
        >
          <SelectTrigger
            className="w-full gap-1.5 sm:w-[190px]"
            size="sm"
            aria-label="Restaurant"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All restaurants</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(period)}
          onValueChange={(v) => navigate({ year: v })}
        >
          <SelectTrigger
            className="w-full gap-1.5 sm:w-[170px]"
            size="sm"
            aria-label="Financial year"
            data-testid="events-cafe-year"
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                FY {budgetYearLabel(y)}
              </SelectItem>
            ))}
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>

        {/* Events | Cafe, with how many of each so an empty tab isn't a surprise */}
        <div
          role="group"
          aria-label="Activity"
          className="inline-flex w-full items-center rounded-lg border bg-muted/40 p-0.5 sm:ml-auto sm:w-auto"
        >
          {(
            [
              {
                value: "events",
                label: "Events",
                count: events.totals.events,
                Icon: Ticket,
              },
              {
                value: "cafe",
                label: "Cafe",
                count: cafe.totals.days,
                Icon: Coffee,
              },
            ] as const
          ).map(({ value, label, count, Icon }) => {
            const active = view === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => navigate({ view: value })}
                data-testid={`events-cafe-tab-${value}`}
                className={cn(
                  "flex min-h-8 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {isPending && (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-label="Loading"
          />
        )}
      </div>

      <section
        className={cn(
          "space-y-5 transition-opacity",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {view === "events" ? (
          <EventsView
            data={events}
            periodLabel={periodLabel}
            placeLabel={placeLabel}
          />
        ) : (
          <CafeView
            data={cafe}
            periodLabel={periodLabel}
            placeLabel={placeLabel}
          />
        )}
      </section>
    </div>
  );
}

// ── Events ─────────────────────────────────────────────────────────────────

function EventsView({
  data,
  periodLabel,
  placeLabel,
}: {
  data: EventsReport;
  periodLabel: string;
  placeLabel: string;
}) {
  const { totals, rows } = data;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title={`No events recorded for ${placeLabel} in ${periodLabel}`}
        body="To record a fundraiser, open the day in Shifts, choose Event on its report, and add the night's income and expenses line by line."
      />
    );
  }

  const categories = rankedShares(totals.byCategory, CATEGORY_KEYS);
  const sources = rankedShares(totals.bySource, SOURCE_KEYS);
  const expenseCategories = rankedShares(
    totals.expensesByCategory,
    EXPENSE_CATEGORY_KEYS
  );

  return (
    <>
      <Slip
        tone="violet"
        label="Event income"
        total={money(totals.total)}
        testId="events-total"
        caption={`${plural(totals.events, "event")} at ${placeLabel} in ${periodLabel}, including GST.`}
        figures={[
          { label: "Income excl. GST", value: money(totals.totalExGst) },
          { label: "GST", value: money(totals.gst) },
          {
            label: "Expenses",
            value: money(totals.expenses),
            testId: "events-expenses",
          },
          {
            label: totals.profit < 0 ? "Loss" : "Profit",
            value: money(totals.profit),
            negative: totals.profit < 0,
            testId: "events-profit",
          },
          {
            label: totals.profitExGst < 0 ? "Loss excl. GST" : "Profit excl. GST",
            value: money(totals.profitExGst),
            negative: totals.profitExGst < 0,
            testId: "events-profit-ex-gst",
          },
          { label: "Guests", value: totals.pax.toLocaleString("en-NZ") },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Breakdown
          title="Income by category"
          tone="violet"
          empty="No income entered yet."
          rows={categories.map((c) => ({
            label: EVENT_INCOME_CATEGORY_LABEL[c.key],
            amount: c.amount,
            share: c.share,
          }))}
        />
        <Breakdown
          title="Income paid by"
          tone="violet"
          empty="No income entered yet."
          rows={sources.map((s) => ({
            label: EVENT_INCOME_SOURCE_LABEL[s.key],
            amount: s.amount,
            share: s.share,
          }))}
        />
        <Breakdown
          title="Expenses by category"
          tone="slate"
          empty="No expenses entered yet."
          className="md:col-span-2 lg:col-span-1"
          testId="events-expense-breakdown"
          rows={expenseCategories.map((c) => ({
            label: EVENT_EXPENSE_CATEGORY_LABEL[c.key],
            amount: c.amount,
            share: c.share,
          }))}
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table data-testid="events-table">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4 text-xs">Event</TableHead>
              <TableHead className="hidden text-xs md:table-cell">
                Restaurant
              </TableHead>
              <TableHead className="hidden text-right text-xs lg:table-cell">
                Guests
              </TableHead>
              <TableHead className="hidden text-right text-xs sm:table-cell">
                Income
              </TableHead>
              <TableHead className="hidden text-right text-xs sm:table-cell">
                Expenses
              </TableHead>
              <TableHead className="text-right text-xs">Profit</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={`${row.date}-${row.location}`}
                data-testid={`events-row-${row.date}`}
              >
                <TableCell className="whitespace-normal py-2.5 pl-4">
                  <p className="font-medium text-foreground">
                    {row.eventName || (
                      <span className="text-muted-foreground">
                        Unnamed event
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(keyToDate(row.date), "EEE d MMM yyyy")}
                    <span className="md:hidden">, {row.location}</span>
                  </p>
                </TableCell>
                <TableCell className="hidden py-2.5 text-sm md:table-cell">
                  {row.location}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm tabular-nums lg:table-cell">
                  {row.pax === null ? (
                    <Dash />
                  ) : (
                    row.pax.toLocaleString("en-NZ")
                  )}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm font-medium tabular-nums sm:table-cell">
                  {row.lineCount === 0 ? (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                      No income yet
                    </span>
                  ) : (
                    money(row.total)
                  )}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {row.expenseLineCount === 0 ? <Dash /> : money(row.expenses)}
                </TableCell>
                <TableCell className="py-2.5 text-right text-sm font-medium tabular-nums">
                  {row.lineCount === 0 && row.expenseLineCount === 0 ? (
                    <Dash />
                  ) : (
                    <Profit amount={row.profit} exGst={row.profitExGst} />
                  )}
                </TableCell>
                <TableCell className="py-2.5 pr-4 text-right">
                  <ReportLink date={row.date} location={row.location} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow className="border-t-2 border-dashed hover:bg-transparent">
              <TableCell className="py-3 pl-4 font-semibold">
                Total
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {plural(totals.events, "event")}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="hidden py-3 text-right tabular-nums lg:table-cell">
                {totals.pax.toLocaleString("en-NZ")}
              </TableCell>
              <TableCell className="hidden py-3 text-right font-semibold tabular-nums sm:table-cell">
                {money(totals.total)}
              </TableCell>
              <TableCell className="hidden py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                {money(totals.expenses)}
              </TableCell>
              <TableCell className="py-3 text-right font-semibold tabular-nums">
                <Profit amount={totals.profit} exGst={totals.profitExGst} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

// ── Cafe ───────────────────────────────────────────────────────────────────

function CafeView({
  data,
  periodLabel,
  placeLabel,
}: {
  data: CafeReport;
  periodLabel: string;
  placeLabel: string;
}) {
  const { totals, rows } = data;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Coffee}
        title={`No cafe days recorded for ${placeLabel} in ${periodLabel}`}
        body="To record a cafe day, open the day in Shifts, choose Cafe on its report, and enter the opening hours, customers and takings."
      />
    );
  }

  return (
    <>
      <Slip
        tone="sky"
        label="Cafe takings"
        total={money(totals.total)}
        testId="cafe-total"
        subtotal={{
          value: `${money(totals.totalExGst)} excl. GST`,
          detail: `${money(totals.gst)} GST`,
          testId: "cafe-total-ex-gst",
        }}
        caption={`${plural(totals.days, "cafe day")} at ${placeLabel} in ${periodLabel}, including GST.`}
        figures={[
          { label: "Cash", value: money(totals.cash) },
          { label: "EFTPOS", value: money(totals.eftpos) },
          {
            label: "Customers",
            value: totals.customers.toLocaleString("en-NZ"),
          },
          {
            label: "Hours open",
            value:
              totals.minutesOpen > 0 ? formatDuration(totals.minutesOpen) : "–",
          },
          {
            label: "Per day",
            value: totals.perDay === null ? "–" : money(totals.perDay),
          },
          {
            label: "Per customer",
            value:
              totals.perCustomer === null ? "–" : money(totals.perCustomer),
          },
        ]}
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table data-testid="cafe-table">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4 text-xs">Day</TableHead>
              <TableHead className="hidden text-xs md:table-cell">
                Hours
              </TableHead>
              <TableHead className="hidden text-right text-xs sm:table-cell">
                Customers
              </TableHead>
              <TableHead className="hidden text-right text-xs lg:table-cell">
                Cash
              </TableHead>
              <TableHead className="hidden text-right text-xs lg:table-cell">
                EFTPOS
              </TableHead>
              <TableHead className="text-right text-xs">Takings</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={`${row.date}-${row.location}`}
                data-testid={`cafe-row-${row.date}`}
              >
                <TableCell className="py-2.5 pl-4">
                  <p className="font-medium text-foreground">
                    {format(keyToDate(row.date), "EEE d MMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.location}
                  </p>
                </TableCell>
                <TableCell className="hidden py-2.5 text-sm md:table-cell">
                  {row.opensAt && row.closesAt ? (
                    <>
                      {formatTimeOfDay(row.opensAt)} to{" "}
                      {formatTimeOfDay(row.closesAt)}
                      {row.minutesOpen !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {formatDuration(row.minutesOpen)}
                        </span>
                      )}
                    </>
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm tabular-nums sm:table-cell">
                  {row.customers === null ? (
                    <Dash />
                  ) : (
                    row.customers.toLocaleString("en-NZ")
                  )}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {row.cash === null ? <Dash /> : money(row.cash)}
                </TableCell>
                <TableCell className="hidden py-2.5 text-right text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {row.eftpos === null ? <Dash /> : money(row.eftpos)}
                </TableCell>
                <TableCell className="py-2.5 text-right text-sm font-medium tabular-nums">
                  {row.total === null ? (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                      No takings yet
                    </span>
                  ) : (
                    <WithExGst amount={row.total} exGst={row.totalExGst ?? 0} />
                  )}
                </TableCell>
                <TableCell className="py-2.5 pr-4 text-right">
                  <ReportLink date={row.date} location={row.location} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-transparent">
            <TableRow className="border-t-2 border-dashed hover:bg-transparent">
              <TableCell className="py-3 pl-4 font-semibold">
                Total
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {plural(totals.days, "day")}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="hidden py-3 text-right tabular-nums sm:table-cell">
                {totals.customers.toLocaleString("en-NZ")}
              </TableCell>
              <TableCell className="hidden py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                {money(totals.cash)}
              </TableCell>
              <TableCell className="hidden py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                {money(totals.eftpos)}
              </TableCell>
              <TableCell className="py-3 text-right font-semibold tabular-nums">
                <WithExGst amount={totals.total} exGst={totals.totalExGst} />
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}

// ── Shared pieces ──────────────────────────────────────────────────────────

const TONE = {
  violet: {
    total: "text-violet-800 dark:text-violet-200",
    label: "text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500 dark:bg-violet-400",
    ring: "ring-violet-500/20",
  },
  sky: {
    total: "text-sky-800 dark:text-sky-200",
    label: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500 dark:bg-sky-400",
    ring: "ring-sky-500/20",
  },
  // Money going out: quieter than the takings it's set against.
  slate: {
    total: "text-slate-800 dark:text-slate-200",
    label: "text-slate-700 dark:text-slate-300",
    bar: "bg-slate-400 dark:bg-slate-500",
    ring: "ring-slate-500/20",
  },
} as const;

const NEGATIVE = "text-rose-700 dark:text-rose-300";

function Slip({
  tone,
  label,
  total,
  caption,
  subtotal,
  figures,
  testId,
}: {
  tone: keyof typeof TONE;
  label: string;
  total: string;
  caption: string;
  /** A second figure for the headline total, e.g. the total excl. GST. */
  subtotal?: { value: string; detail?: string; testId?: string };
  figures: {
    label: string;
    value: string;
    negative?: boolean;
    testId?: string;
  }[];
  testId: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "grain relative overflow-hidden rounded-2xl bg-card ring-1",
        t.ring
      )}
    >
      <div className="grid gap-px bg-border/60 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="bg-card px-6 py-6 sm:px-8 sm:py-7">
          <p className={cn("text-sm font-medium", t.label)}>{label}</p>
          <p
            className={cn(
              "display mt-1 text-5xl tabular-nums sm:text-6xl",
              t.total
            )}
            data-testid={testId}
          >
            {total}
          </p>
          {subtotal && (
            <p className="mt-2 text-base tabular-nums">
              <span
                className="font-semibold text-foreground"
                data-testid={subtotal.testId}
              >
                {subtotal.value}
              </span>
              {subtotal.detail && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {subtotal.detail}
                </span>
              )}
            </p>
          )}
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            {caption}
          </p>
        </div>
        {/* Three figures sit in one row; six fill a 2 × 3 or 3 × 2 grid,
            so no layout ever leaves an empty cell. */}
        <dl
          className={cn(
            "grid gap-px",
            figures.length === 3
              ? "grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-2"
          )}
        >
          {figures.map((f) => (
            <div
              key={f.label}
              className="flex flex-col justify-center bg-card px-4 py-4 sm:px-6"
            >
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums",
                  f.negative && NEGATIVE
                )}
                data-testid={f.testId}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Breakdown({
  title,
  tone,
  rows,
  empty,
  className,
  testId,
}: {
  title: string;
  tone: keyof typeof TONE;
  rows: { label: string; amount: number; share: number }[];
  empty: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn("rounded-xl border bg-card p-5", className)}
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{r.label}</span>
                <span className="tabular-nums">
                  <span className="font-medium">{money(r.amount)}</span>
                  <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">
                    {Math.round(r.share * 100)}%
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", TONE[tone].bar)}
                  style={{ width: `${Math.max(r.share * 100, 1)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl border border-dashed bg-card px-6 py-14 text-center"
      data-testid="events-cafe-empty"
    >
      <Icon className="mx-auto h-8 w-8 text-muted-foreground/60" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {body}
      </p>
      <Link
        href="/admin/shifts"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
      >
        Go to Shifts
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function ReportLink({ date, location }: { date: string; location: string }) {
  return (
    <Link
      href={reportHref(date, location)}
      className="inline-flex items-center gap-0.5 whitespace-nowrap rounded text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Open the report for ${format(keyToDate(date), "EEE d MMM yyyy")} at ${location}`}
    >
      Open
      <ArrowUpRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}

/** An event's profit, red when it made a loss, with the excl. GST figure. */
function Profit({ amount, exGst }: { amount: number; exGst: number }) {
  return (
    <WithExGst amount={amount} exGst={exGst} negative={amount < 0} />
  );
}

/** A GST-inclusive amount with its excl. GST figure beneath. */
function WithExGst({
  amount,
  exGst,
  negative = false,
}: {
  amount: number;
  exGst: number;
  negative?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-end">
      <span className={cn(negative && NEGATIVE)}>{money(amount)}</span>
      <span
        className={cn(
          "whitespace-nowrap text-[11px] font-normal",
          exGst < 0 ? NEGATIVE : "text-muted-foreground"
        )}
      >
        {money(exGst)} excl. GST
      </span>
    </span>
  );
}

function Dash() {
  return <span className="text-muted-foreground/50">–</span>;
}
