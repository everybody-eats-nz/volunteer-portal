"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EVENT_INCOME_CATEGORIES,
  EVENT_INCOME_CATEGORY_HINT,
  EVENT_INCOME_CATEGORY_LABEL,
  EVENT_INCOME_SOURCES,
  EVENT_INCOME_SOURCE_LABEL,
  type EventIncomeCategory,
  type EventIncomeSource,
  type EventIncomeSummary,
} from "@/lib/day-reports";

/** An income line as typed: the amount stays a string until it's saved. */
export interface IncomeDraft {
  key: string;
  category: EventIncomeCategory;
  source: EventIncomeSource;
  description: string;
  amount: string;
  gstIncluded: boolean;
}

// Ticket and merch sales are the usual taxable takings; gifts aren't.
const GST_BY_DEFAULT: Record<EventIncomeCategory, boolean> = {
  KOHA: false,
  SALES: true,
  AUCTION: false,
  DONATION: false,
  OTHER: false,
};

let draftSeq = 0;
export function newIncomeDraft(
  partial: Partial<Omit<IncomeDraft, "key">> = {}
): IncomeDraft {
  const category = partial.category ?? "SALES";
  return {
    key: `income-${++draftSeq}`,
    category,
    source: partial.source ?? "EFTPOS",
    description: partial.description ?? "",
    amount: partial.amount ?? "",
    gstIncluded: partial.gstIncluded ?? GST_BY_DEFAULT[category],
  };
}

/** A line with nothing typed in it is skipped on save rather than rejected. */
export function isBlankIncomeDraft(line: IncomeDraft): boolean {
  return line.amount.trim() === "" && line.description.trim() === "";
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

export function EventIncomeEditor({
  lines,
  onChange,
  summary,
}: {
  lines: IncomeDraft[];
  onChange: (lines: IncomeDraft[]) => void;
  summary: EventIncomeSummary;
}) {
  const update = (key: string, patch: Partial<IncomeDraft>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));
  const add = () => {
    // A new line starts from the last one's source: takings tend to be
    // entered one till or one invoice batch at a time.
    const last = lines.at(-1);
    onChange([...lines, newIncomeDraft({ source: last?.source })]);
  };

  const categoriesUsed = EVENT_INCOME_CATEGORIES.filter(
    (c) => summary.byCategory[c] !== 0
  );

  return (
    <div className="sm:col-span-2" data-testid="event-income-editor">
      {lines.length > 0 && (
        <div
          aria-hidden
          className="mb-1.5 hidden grid-cols-[8.5rem_7.5rem_minmax(0,1fr)_8rem_5.5rem_2.25rem] gap-2 px-1 text-[11px] font-medium text-muted-foreground lg:grid"
        >
          <span>Category</span>
          <span>Paid by</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>GST</span>
          <span />
        </div>
      )}

      <ol className="space-y-2">
        {lines.map((line, index) => (
          <IncomeRow
            key={line.key}
            line={line}
            index={index}
            onChange={(patch) => update(line.key, patch)}
            onRemove={() => remove(line.key)}
          />
        ))}
      </ol>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-300/70 bg-violet-50/40 px-4 py-6 text-center dark:border-violet-800/60 dark:bg-violet-950/20">
          <p className="text-sm font-medium text-foreground">
            No income recorded yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Add a line for each kind of takings: ticket sales on EFTPOS, cash
            koha at the door, auction lots, a sponsor&rsquo;s invoice.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="mt-3 gap-1.5"
            data-testid="event-income-add"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add income
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={add}
          className="mt-2 gap-1.5 text-violet-700 hover:bg-violet-100/70 hover:text-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/40"
          data-testid="event-income-add"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add another line
        </Button>
      )}

      {lines.length > 0 && (
        <div
          className="mt-4 grid gap-4 rounded-xl bg-muted/40 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]"
          data-testid="event-income-summary"
        >
          {/* By category: what the night was made of */}
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {categoriesUsed.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Amounts will add up here as you enter them.
              </p>
            ) : (
              categoriesUsed.map((c) => (
                <div key={c}>
                  <dt className="text-[11px] text-muted-foreground">
                    {EVENT_INCOME_CATEGORY_LABEL[c]}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {NZD.format(summary.byCategory[c])}
                  </dd>
                </div>
              ))
            )}
          </dl>
          {/* Totals: incl. GST, the GST in it, and what's left */}
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm sm:text-right">
            <dt className="text-muted-foreground">Total incl. GST</dt>
            <dd
              className="font-semibold tabular-nums"
              data-testid="event-total"
            >
              {NZD.format(summary.total)}
            </dd>
            <dt className="text-muted-foreground">GST</dt>
            <dd className="tabular-nums" data-testid="event-gst">
              {NZD.format(summary.gst)}
            </dd>
            <dt className="text-muted-foreground">Total excl. GST</dt>
            <dd className="tabular-nums" data-testid="event-total-ex-gst">
              {NZD.format(summary.totalExGst)}
            </dd>
          </dl>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">
        Enter amounts as taken, including any GST. Tick GST on taxable lines,
        such as ticket and merch sales. Event income is kept out of koha totals.
      </p>
    </div>
  );
}

function IncomeRow({
  line,
  index,
  onChange,
  onRemove,
}: {
  line: IncomeDraft;
  index: number;
  onChange: (patch: Partial<IncomeDraft>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const n = index + 1;
  // On small screens each control shows its own label; on wide screens the
  // column headings do, and the labels stay for screen readers.
  const cellLabel =
    "mb-1 block text-[11px] font-medium text-muted-foreground lg:sr-only";
  const amountInvalid =
    line.amount.trim() === "" && line.description.trim() !== "";

  return (
    <li
      className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card p-2.5 lg:grid-cols-[8.5rem_7.5rem_minmax(0,1fr)_8rem_5.5rem_2.25rem] lg:items-center lg:rounded-lg lg:border-transparent lg:bg-transparent lg:p-0 lg:px-1"
      data-testid={`event-income-line-${index}`}
    >
      <div>
        <label htmlFor={`${id}-category`} className={cellLabel}>
          Category
          <span className="sr-only">, line {n}</span>
        </label>
        <Select
          value={line.category}
          onValueChange={(v) => {
            const category = v as EventIncomeCategory;
            onChange({ category, gstIncluded: GST_BY_DEFAULT[category] });
          }}
        >
          <SelectTrigger id={`${id}-category`} size="md" className="w-full">
            {/* Just the label: the hints are for choosing, not for the row */}
            <SelectValue>
              {EVENT_INCOME_CATEGORY_LABEL[line.category]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EVENT_INCOME_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                <span>{EVENT_INCOME_CATEGORY_LABEL[c]}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {EVENT_INCOME_CATEGORY_HINT[c]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor={`${id}-source`} className={cellLabel}>
          Paid by
          <span className="sr-only">, line {n}</span>
        </label>
        <Select
          value={line.source}
          onValueChange={(v) => onChange({ source: v as EventIncomeSource })}
        >
          <SelectTrigger id={`${id}-source`} size="md" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_INCOME_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {EVENT_INCOME_SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="col-span-2 lg:col-span-1">
        <label htmlFor={`${id}-description`} className={cellLabel}>
          Description
          <span className="sr-only">, line {n}</span>
        </label>
        <Input
          id={`${id}-description`}
          value={line.description}
          maxLength={120}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="e.g. Door tickets"
        />
      </div>

      <div>
        <label htmlFor={`${id}-amount`} className={cellLabel}>
          Amount
          <span className="sr-only">, line {n}</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id={`${id}-amount`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={line.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0.00"
            aria-invalid={amountInvalid || undefined}
            className="pl-7 text-right tabular-nums"
          />
        </div>
      </div>

      <div className="flex items-end gap-2 lg:items-center">
        <label
          htmlFor={`${id}-gst`}
          className={cn(
            "flex min-h-9 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 text-sm",
            line.gstIncluded ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Checkbox
            id={`${id}-gst`}
            checked={line.gstIncluded}
            onCheckedChange={(checked) =>
              onChange({ gstIncluded: checked === true })
            }
            aria-label={`Line ${n} includes GST`}
          />
          <span aria-hidden>
            <span className="whitespace-nowrap lg:hidden">GST</span>
            <span className="hidden lg:inline">Incl.</span>
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove income line ${n}`}
          className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 lg:hidden dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove income line ${n}`}
        className="hidden h-9 w-9 text-muted-foreground hover:bg-red-50 hover:text-red-700 lg:inline-flex dark:hover:bg-red-950/40 dark:hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
