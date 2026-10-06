"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar as CalendarIcon,
  Check,
  Copy,
  Loader2,
  MapPin,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  CASH_RANGE_PRESETS,
  CASH_FLAG_LABEL,
  buildCashCopyText,
  formatCashRange,
  formatMoney as money,
  formatNight as nightLabel,
  keyToLocalDate as keyToDate,
  type CashFlag,
  type CashNight,
  type CashRangePreset,
  type CashReconciliation,
} from "@/lib/cash-reconciliation";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "../_components/primitives";

const FLAG_HINT: Record<CashFlag, string> = {
  "no-cash": "The night was saved with the cash field blank.",
  "no-record": "Shifts ran, but nothing was recorded for the night.",
};

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

interface Props {
  data: CashReconciliation | null;
  location: string;
  locations: string[];
  range: CashRangePreset | "custom";
  from: string;
  to: string;
  today: string;
}

export function CashReconciliationClient({
  data,
  location,
  locations,
  range,
  from,
  to,
  today,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date }>({
    from: keyToDate(from),
    to: keyToDate(to),
  });

  const navigate = (patch: {
    location?: string;
    range?: CashRangePreset;
    from?: string;
    to?: string;
  }) => {
    const params = new URLSearchParams({ location: patch.location ?? location });
    if (patch.from && patch.to) {
      params.set("from", patch.from);
      params.set("to", patch.to);
    } else if (patch.range) {
      params.set("range", patch.range);
    } else if (range === "custom") {
      params.set("from", from);
      params.set("to", to);
    } else {
      params.set("range", range);
    }
    startTransition(() => {
      router.push(`/admin/analytics/cash?${params}`, { scroll: false });
    });
  };

  const applyCustomRange = () => {
    if (!draft.from) return;
    const f = format(draft.from, "yyyy-MM-dd");
    const t = format(draft.to ?? draft.from, "yyyy-MM-dd");
    setRangeOpen(false);
    navigate({ from: f, to: t });
  };

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildCashCopyText(data));
      setCopied(true);
      toast.success("Copied cash summary");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  const presetOptions: { value: CashRangePreset | "custom"; label: string }[] =
    range === "custom"
      ? [...CASH_RANGE_PRESETS, { value: "custom", label: "Custom" }]
      : [...CASH_RANGE_PRESETS];

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
        No restaurant locations yet.
      </div>
    );
  }

  const totals = data?.totals;
  const nights = data?.nights ?? [];

  return (
    <div className="space-y-5 pb-12">
      {/* Controls */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm print:hidden"
        data-testid="cash-filters"
      >
        <Select
          value={location}
          onValueChange={(v) => navigate({ location: v })}
        >
          <SelectTrigger
            className="w-full gap-1.5 sm:w-[180px]"
            size="sm"
            aria-label="Restaurant"
            data-testid="cash-location-select"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="hidden md:block">
          <SegmentedControl
            size="md"
            value={range}
            onChange={(v) => {
              if (v !== "custom") navigate({ range: v });
            }}
            options={presetOptions}
          />
        </div>
        <Select
          value={range}
          onValueChange={(v) => {
            if (v !== "custom") navigate({ range: v as CashRangePreset });
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[160px] md:hidden"
            size="sm"
            aria-label="Period"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover
          open={rangeOpen}
          onOpenChange={(open) => {
            setRangeOpen(open);
            if (open) setDraft({ from: keyToDate(from), to: keyToDate(to) });
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant={range === "custom" ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "w-full justify-start gap-2 font-normal sm:w-auto",
                range !== "custom" && "text-muted-foreground"
              )}
              data-testid="cash-custom-range"
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {range === "custom" ? formatCashRange(from, to) : "Custom range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              captionLayout="dropdown"
              startMonth={new Date(2017, 0, 1)}
              endMonth={keyToDate(today)}
              defaultMonth={draft.from}
              selected={{ from: draft.from, to: draft.to }}
              onSelect={(r) => setDraft({ from: r?.from, to: r?.to })}
              numberOfMonths={2}
              autoFocus
            />
            <div className="flex items-center justify-between gap-3 border-t p-3">
              <p className="text-xs text-muted-foreground">
                {draft.from
                  ? formatCashRange(
                      format(draft.from, "yyyy-MM-dd"),
                      format(draft.to ?? draft.from, "yyyy-MM-dd")
                    )
                  : "Pick the first night"}
              </p>
              <Button
                size="sm"
                onClick={applyCustomRange}
                disabled={!draft.from}
              >
                Show range
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {isPending && (
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground"
            aria-label="Loading"
          />
        )}
      </div>

      <section
        id="cash-reconciliation-printable"
        className={cn(
          "space-y-5 transition-opacity",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        <p className="eyebrow hidden print:block">
          Everybody Eats · Cash reconciliation
        </p>

        {/* Deposit slip */}
        <div
          className="grain relative overflow-hidden rounded-2xl bg-card ring-1 ring-forest-500/15 print:border dark:ring-cream-50/15"
          data-testid="cash-summary"
        >
          <div className="grid gap-px bg-forest-500/10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] dark:bg-cream-50/10">
            <div className="bg-card px-6 py-6 sm:px-8 sm:py-7">
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow pt-2 text-forest-500/80 dark:text-cream-50/60">
                  Cash to bank
                </p>
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!data || nights.length === 0}
                    data-testid="cash-copy"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    disabled={!data || nights.length === 0}
                    data-testid="cash-print"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
              <p
                className="display mt-1 text-5xl tabular-nums text-forest-700 sm:text-6xl dark:text-cream-50"
                data-testid="cash-total"
              >
                {money(totals?.cash ?? 0)}
              </p>
              {/* One line when there's room; stacked (without the dots) otherwise,
                  so a wrap never strands a dot at the end of a line. */}
              <p className="mt-3 flex flex-col gap-0.5 text-sm text-muted-foreground xl:flex-row xl:items-center xl:gap-x-2 print:flex-col print:items-start">
                <span className="font-medium text-foreground">{location}</span>
                <span aria-hidden className="hidden xl:inline print:hidden">
                  ·
                </span>
                <span>{formatCashRange(from, to)}</span>
                <span aria-hidden className="hidden xl:inline print:hidden">
                  ·
                </span>
                <span>{plural(totals?.nights ?? 0, "service night")}</span>
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-px md:grid-cols-1">
              <SlipFigure label="EFTPOS" value={money(totals?.eftpos ?? 0)} />
              <SlipFigure label="Stripe" value={money(totals?.stripe ?? 0)} />
              <SlipFigure
                label="Flagged"
                value={String(totals?.flagged ?? 0)}
                tone={totals && totals.flagged > 0 ? "warn" : "ok"}
                testId="cash-flagged-count"
              />
            </dl>
          </div>
        </div>

        {totals && totals.flagged > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
            data-testid="cash-flag-callout"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {plural(totals.flagged, "night")} with no cash recorded
              </p>
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-200/80">
                A blank isn&rsquo;t $0. Check the takings for{" "}
                {totals.flagged === 1 ? "that night" : "those nights"} before
                you reconcile, so the total above matches what went to the
                bank.
              </p>
            </div>
          </div>
        )}

        {/* Night by night */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table data-testid="cash-nights-table">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-4 text-xs">Service night</TableHead>
                <TableHead className="text-right text-xs">Cash</TableHead>
                <TableHead className="hidden text-right text-xs sm:table-cell">
                  EFTPOS
                </TableHead>
                <TableHead className="hidden text-right text-xs sm:table-cell">
                  Stripe
                </TableHead>
                <TableHead className="w-0 print:hidden">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nights.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No service nights at {location} in this range.
                  </TableCell>
                </TableRow>
              ) : (
                nights.map((n) => (
                  <NightRow key={n.date} night={n} location={location} />
                ))
              )}
            </TableBody>
            {nights.length > 0 && totals && (
              <TableFooter className="bg-transparent">
                <TableRow className="border-t-2 border-dashed border-forest-500/25 hover:bg-transparent dark:border-cream-50/20">
                  <TableCell className="pl-4 py-3 font-semibold">
                    Total
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {plural(totals.nights, "night")}
                    </span>
                  </TableCell>
                  <TableCell
                    className="py-3 text-right text-base font-semibold tabular-nums"
                    data-testid="cash-table-total"
                  >
                    {money(totals.cash)}
                  </TableCell>
                  <TableCell className="hidden py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {money(totals.eftpos)}
                  </TableCell>
                  <TableCell className="hidden py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {money(totals.stripe)}
                  </TableCell>
                  <TableCell className="print:hidden" />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>

        <p className="hidden text-xs text-muted-foreground print:block">
          Printed {format(new Date(), "d MMM yyyy, h:mm a")} from the Everybody
          Eats volunteer portal.
        </p>
      </section>
    </div>
  );
}

function SlipFigure({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
  testId?: string;
}) {
  return (
    <div className="flex flex-col justify-center bg-card px-4 py-4 sm:px-6">
      <dt className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "ok" && "text-emerald-700 dark:text-emerald-400"
        )}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}

function NightRow({ night, location }: { night: CashNight; location: string }) {
  const flagged = night.status !== "recorded";
  const minor = (v: number | null) =>
    v === null ? (
      <span className="text-muted-foreground/50">–</span>
    ) : (
      money(v)
    );

  return (
    <TableRow
      className={cn(flagged && "bg-amber-500/[0.06] hover:bg-amber-500/10")}
      data-testid={`cash-night-${night.date}`}
      data-status={night.status}
    >
      <TableCell className="whitespace-nowrap py-2.5 pl-4 text-sm">
        <span className="sm:hidden">
          {format(keyToDate(night.date), "EEE d MMM")}
        </span>
        <span className="hidden sm:inline">{nightLabel(night.date)}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap py-2.5 text-right text-sm tabular-nums">
        {night.status === "recorded" && night.cash !== null ? (
          <span className="font-medium">{money(night.cash)}</span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
            title={FLAG_HINT[night.status as CashFlag]}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {CASH_FLAG_LABEL[night.status as CashFlag]}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap py-2.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
        {minor(night.eftpos)}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap py-2.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
        {minor(night.stripe)}
      </TableCell>
      <TableCell className="py-2.5 pr-4 text-right print:hidden">
        <Link
          href={`/admin/shifts?${new URLSearchParams({ date: night.date, location })}`}
          className={cn(
            "inline-flex items-center gap-0.5 whitespace-nowrap rounded text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            flagged
              ? "text-amber-800 dark:text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={`${flagged ? "Record" : "View"} ${nightLabel(night.date)}`}
        >
          {flagged ? "Record" : "View"}
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      </TableCell>
    </TableRow>
  );
}
