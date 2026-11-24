"use client";

import { useId } from "react";
import { PiggyBank, Plus, Trash2 } from "lucide-react";
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
  EVENT_EXPENSE_CATEGORIES,
  EVENT_EXPENSE_CATEGORY_HINT,
  EVENT_EXPENSE_CATEGORY_LABEL,
  EVENT_INCOME_CATEGORIES,
  EVENT_INCOME_CATEGORY_HINT,
  EVENT_INCOME_CATEGORY_LABEL,
  EVENT_INCOME_SOURCES,
  EVENT_INCOME_SOURCE_LABEL,
  type EventExpenseCategory,
  type EventIncomeCategory,
  type EventIncomeSource,
  type EventProfit,
  profitLabel,
} from "@/lib/day-reports";
import { SectionCard } from "@/components/day-report/fields";
import { EstimateBadge } from "@/components/day-report/estimate-badge";

/**
 * Itemised lines for an event or catering gig: the income it took and what it
 * cost to put on.
 * Both are lists of category / description / amount / GST lines; income also
 * records how each line was paid. Any line can be an estimate, so an event can
 * be planned here first and its lines made actual as the real figures come in.
 */

/** A line as typed: the amount stays a string until it's saved. */
export interface IncomeDraft {
  key: string;
  category: EventIncomeCategory;
  source: EventIncomeSource;
  description: string;
  amount: string;
  gstIncluded: boolean;
  estimated: boolean;
}

export interface ExpenseDraft {
  key: string;
  category: EventExpenseCategory;
  description: string;
  amount: string;
  gstIncluded: boolean;
  estimated: boolean;
}

// Ticket and merch sales and hire / catering invoices are the usual taxable
// takings; gifts aren't.
const INCOME_GST_BY_DEFAULT: Record<EventIncomeCategory, boolean> = {
  KOHA: false,
  SALES: true,
  INVOICE: true,
  AUCTION: false,
  DONATION: false,
  OTHER: false,
};

// Supplier bills usually include GST; wages never do.
const EXPENSE_GST_BY_DEFAULT: Record<EventExpenseCategory, boolean> = {
  STAFFING: false,
  FOOD: true,
  LICENCES: true,
  EQUIPMENT_HIRE: true,
  DECOR: true,
  DRINKS: true,
  OTHER: false,
};

let draftSeq = 0;
const nextKey = (kind: string) => `${kind}-${++draftSeq}`;

export function newIncomeDraft(
  partial: Partial<Omit<IncomeDraft, "key">> = {}
): IncomeDraft {
  const category = partial.category ?? "SALES";
  return {
    key: nextKey("income"),
    category,
    source: partial.source ?? "EFTPOS",
    description: partial.description ?? "",
    amount: partial.amount ?? "",
    gstIncluded: partial.gstIncluded ?? INCOME_GST_BY_DEFAULT[category],
    estimated: partial.estimated ?? false,
  };
}

export function newExpenseDraft(
  partial: Partial<Omit<ExpenseDraft, "key">> = {}
): ExpenseDraft {
  const category = partial.category ?? "FOOD";
  return {
    key: nextKey("expense"),
    category,
    description: partial.description ?? "",
    amount: partial.amount ?? "",
    gstIncluded: partial.gstIncluded ?? EXPENSE_GST_BY_DEFAULT[category],
    estimated: partial.estimated ?? false,
  };
}

/** A line with nothing typed in it is skipped on save rather than rejected. */
export function isBlankLineDraft(
  line: Pick<IncomeDraft, "amount" | "description">
): boolean {
  return line.amount.trim() === "" && line.description.trim() === "";
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

/** The totals an editor shows under its lines. */
export interface LinesSummary<C extends string> {
  total: number;
  gst: number;
  totalExGst: number;
  byCategory: Record<C, number>;
  estimatedLines: number;
}

export function EventIncomeEditor({
  lines,
  onChange,
  summary,
  noun = "event",
}: {
  lines: IncomeDraft[];
  onChange: (lines: IncomeDraft[]) => void;
  summary: LinesSummary<EventIncomeCategory>;
  /** What the takings were for: "event", "catering gig". */
  noun?: string;
}) {
  return (
    <LinesEditor
      kind="income"
      lines={lines}
      onChange={onChange}
      summary={summary}
      categories={EVENT_INCOME_CATEGORIES}
      categoryLabel={EVENT_INCOME_CATEGORY_LABEL}
      categoryHint={EVENT_INCOME_CATEGORY_HINT}
      // An invoiced hire or catering job is paid by invoice.
      onCategory={(category) => ({
        category,
        gstIncluded: INCOME_GST_BY_DEFAULT[category],
        ...(category === "INVOICE" ? { source: "INVOICE" as const } : {}),
      })}
      // A new line starts from the last one's source and status: takings
      // tend to be entered one till or one invoice batch at a time, and a
      // plan is all estimates.
      newLine={() =>
        newIncomeDraft({
          source: lines.at(-1)?.source,
          estimated: lines.at(-1)?.estimated,
        })
      }
      sourceColumn={{
        options: EVENT_INCOME_SOURCES,
        label: EVENT_INCOME_SOURCE_LABEL,
        value: (line) => line.source,
        patch: (source) => ({ source }),
      }}
      copy={{
        emptyTitle: "No income recorded yet",
        emptyBody:
          noun === "event"
            ? "Add a line for each kind of takings: ticket sales on EFTPOS, cash koha at the door, auction lots, an invoice for a venue hire."
            : `Add a line for each payment for the ${noun}: usually one invoice to the client, plus any cash or EFTPOS on the day.`,
        add: "Add income",
        descriptionPlaceholder:
          noun === "event" ? "e.g. Door tickets" : "e.g. Invoice to client",
        footnote:
          "Enter amounts as taken, including any GST. Tick GST on taxable lines, such as ticket sales and hire or catering invoices. Planning ahead? Mark lines as estimates, then switch them to actual once the money is in. Event and catering income is kept out of koha totals.",
      }}
    />
  );
}

export function EventExpenseEditor({
  lines,
  onChange,
  summary,
  noun = "event",
}: {
  lines: ExpenseDraft[];
  onChange: (lines: ExpenseDraft[]) => void;
  summary: LinesSummary<EventExpenseCategory>;
  /** What the costs were for: "event", "catering gig". */
  noun?: string;
}) {
  return (
    <LinesEditor
      kind="expense"
      lines={lines}
      onChange={onChange}
      summary={summary}
      categories={EVENT_EXPENSE_CATEGORIES}
      categoryLabel={EVENT_EXPENSE_CATEGORY_LABEL}
      categoryHint={EVENT_EXPENSE_CATEGORY_HINT}
      onCategory={(category) => ({
        category,
        gstIncluded: EXPENSE_GST_BY_DEFAULT[category],
      })}
      newLine={() => newExpenseDraft({ estimated: lines.at(-1)?.estimated })}
      copy={{
        emptyTitle: "No expenses recorded yet",
        emptyBody:
          noun === "event"
            ? "Add a line for each cost of putting the event on: staff, food and drinks, licences, hired equipment, decorations."
            : `Add a line for each cost of the ${noun}: staff, food and drinks, packaging, delivery, hired equipment.`,
        add: "Add expense",
        descriptionPlaceholder: "e.g. Marquee hire",
        footnote:
          "Enter amounts as paid, including any GST. Tick GST on bills that charge it, so the GST can be claimed back. Mark costs you haven't been billed for yet as estimates.",
      }}
    />
  );
}

/** A section's running total for its header, flagged when it has estimates. */
export function SectionTotal({
  total,
  estimated,
}: {
  total: number;
  estimated: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {estimated && <EstimateBadge label="Includes estimates" />}
      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-300">
        {NZD.format(total)}
      </span>
    </span>
  );
}

/**
 * Income less expenses, as entered and excl. GST. The excl. GST figure is
 * what the event really made: GST on the takings goes to IRD and GST on the
 * bills is claimed back.
 */
export function EventProfitStatement({
  income,
  expenses,
  profit,
  estimated = false,
  noun = "event",
  heading,
}: {
  income: Pick<LinesSummary<string>, "total" | "totalExGst" | "estimatedLines">;
  expenses: Pick<
    LinesSummary<string>,
    "total" | "totalExGst" | "estimatedLines"
  >;
  profit: EventProfit;
  /** Any line behind the figures is an estimate. */
  estimated?: boolean;
  /** Whose profit it is: "event", "catering gig", "day". */
  noun?: string;
  /** The card's heading, when "Profit" alone wouldn't say whose. */
  heading?: string;
}) {
  const loss = profit.profit < 0;
  const title = profitLabel(profit.profit, estimated);
  const lineName = (
    name: string,
    lines: Pick<LinesSummary<string>, "estimatedLines">
  ) => (
    <span className="inline-flex items-center gap-1.5">
      {name}
      {lines.estimatedLines > 0 && <EstimateBadge label="Includes estimates" />}
    </span>
  );
  // Expenses read as deductions; never "-$0.00".
  const less = (n: number) => NZD.format(n === 0 ? 0 : -n);
  const cell = "py-1.5 pl-3 text-right tabular-nums sm:pl-4";
  return (
    <SectionCard
      icon={PiggyBank}
      title={heading ?? title}
      tone="violet"
      action={
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            loss
              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
              : "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
          )}
        >
          {NZD.format(profit.profit)}
        </span>
      }
    >
      <div className="sm:col-span-2" data-testid="event-profit">
        <table className="w-full text-[13px] sm:max-w-md sm:text-sm">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="pb-1 text-left font-medium">
                <span className="sr-only">Line</span>
              </th>
              <th className="whitespace-nowrap pb-1 pl-3 text-right font-medium sm:pl-4">Incl. GST</th>
              <th className="whitespace-nowrap pb-1 pl-3 text-right font-medium sm:pl-4">Excl. GST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal">
                {lineName("Income", income)}
              </th>
              <td className={cell}>{NZD.format(income.total)}</td>
              <td className={cn(cell, "text-muted-foreground")}>
                {NZD.format(income.totalExGst)}
              </td>
            </tr>
            <tr>
              <th scope="row" className="py-1.5 text-left font-normal">
                {lineName("Expenses", expenses)}
              </th>
              <td className={cell}>{less(expenses.total)}</td>
              <td className={cn(cell, "text-muted-foreground")}>
                {less(expenses.totalExGst)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr
              className={cn(
                "border-t border-dashed font-semibold",
                loss
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-violet-800 dark:text-violet-200"
              )}
            >
              <th scope="row" className="pt-2 text-left">
                {title}
              </th>
              <td className={cn(cell, "pt-2")} data-testid="event-profit-total">
                {NZD.format(profit.profit)}
              </td>
              <td
                className={cn(cell, "pt-2")}
                data-testid="event-profit-ex-gst"
              >
                {NZD.format(profit.profitExGst)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Excl. GST is what the {noun} made once the GST on its income is paid
          and the GST on its expenses is claimed back.
          {estimated &&
            " It includes estimates, so it will change as the actual figures come in."}
        </p>
      </div>
    </SectionCard>
  );
}

interface LineBase<C extends string> {
  key: string;
  category: C;
  description: string;
  amount: string;
  gstIncluded: boolean;
  estimated: boolean;
}

interface SourceColumn<L, S extends string> {
  options: readonly S[];
  label: Record<S, string>;
  value: (line: L) => S;
  patch: (source: S) => Partial<L>;
}

function LinesEditor<C extends string, L extends LineBase<C>, S extends string>({
  kind,
  lines,
  onChange,
  summary,
  categories,
  categoryLabel,
  categoryHint,
  onCategory,
  newLine,
  sourceColumn,
  copy,
}: {
  kind: "income" | "expense";
  lines: L[];
  onChange: (lines: L[]) => void;
  summary: LinesSummary<C>;
  categories: readonly C[];
  categoryLabel: Record<C, string>;
  categoryHint: Record<C, string>;
  onCategory: (category: C) => Partial<L>;
  newLine: () => L;
  sourceColumn?: SourceColumn<L, S>;
  copy: {
    emptyTitle: string;
    emptyBody: string;
    add: string;
    descriptionPlaceholder: string;
    footnote: string;
  };
}) {
  const update = (key: string, patch: Partial<L>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key));
  const add = () => onChange([...lines, newLine()]);

  const categoriesUsed = categories.filter((c) => summary.byCategory[c] !== 0);
  const testId = `event-${kind}`;
  // Expenses have no "Paid by", so their category gets the room instead.
  const columns = sourceColumn
    ? "@4xl:grid-cols-[8.5rem_7.5rem_minmax(0,1fr)_8rem_5rem_9rem_2.25rem]"
    : "@4xl:grid-cols-[10.5rem_minmax(0,1fr)_8rem_5rem_9rem_2.25rem]";

  // Lines go columnar when the editor itself is wide enough, not the window:
  // beside the admin sidebar a laptop-width window is still narrow.
  return (
    <div className="@container sm:col-span-2" data-testid={`${testId}-editor`}>
      {lines.length > 0 && (
        <div
          aria-hidden
          className={cn(
            "mb-1.5 hidden gap-2 px-1 text-[11px] font-medium text-muted-foreground @4xl:grid",
            columns
          )}
        >
          <span>Category</span>
          {sourceColumn && <span>Paid by</span>}
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>GST</span>
          <span>Actual or estimate</span>
          <span />
        </div>
      )}

      <ol className="space-y-2">
        {lines.map((line, index) => (
          <LineRow
            key={line.key}
            kind={kind}
            line={line}
            index={index}
            columns={columns}
            categories={categories}
            categoryLabel={categoryLabel}
            categoryHint={categoryHint}
            sourceColumn={sourceColumn}
            descriptionPlaceholder={copy.descriptionPlaceholder}
            onCategory={(c) => update(line.key, onCategory(c))}
            onChange={(patch) => update(line.key, patch)}
            onRemove={() => remove(line.key)}
          />
        ))}
      </ol>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-violet-300/70 bg-violet-50/40 px-4 py-6 text-center dark:border-violet-800/60 dark:bg-violet-950/20">
          <p className="text-sm font-medium text-foreground">
            {copy.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            {copy.emptyBody}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="mt-3 gap-1.5"
            data-testid={`${testId}-add`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {copy.add}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={add}
          className="mt-2 gap-1.5 text-violet-700 hover:bg-violet-100/70 hover:text-violet-800 dark:text-violet-300 dark:hover:bg-violet-900/40"
          data-testid={`${testId}-add`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add another line
        </Button>
      )}

      {lines.length > 0 && (
        <div
          className="mt-4 grid gap-4 rounded-xl bg-muted/40 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]"
          data-testid={`${testId}-summary`}
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
                    {categoryLabel[c]}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {NZD.format(summary.byCategory[c])}
                  </dd>
                </div>
              ))
            )}
          </dl>
          {/* Totals: incl. GST, the GST in it, and what's left. Estimates
              count in them, flagged beneath. */}
          <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-0.5 text-sm sm:text-right">
            <dt className="text-muted-foreground">Total incl. GST</dt>
            <dd
              className="font-semibold tabular-nums"
              data-testid={`${testId}-total`}
            >
              {NZD.format(summary.total)}
            </dd>
            <dt className="text-muted-foreground">GST</dt>
            <dd className="tabular-nums" data-testid={`${testId}-gst`}>
              {NZD.format(summary.gst)}
            </dd>
            <dt className="text-muted-foreground">Total excl. GST</dt>
            <dd className="tabular-nums" data-testid={`${testId}-total-ex-gst`}>
              {NZD.format(summary.totalExGst)}
            </dd>
          </dl>
          {summary.estimatedLines > 0 && (
            <p className="sm:col-start-2 sm:text-right">
              <EstimateBadge testId={`${testId}-estimates`}>
                {`Includes ${summary.estimatedLines} ${
                  summary.estimatedLines === 1 ? "estimate" : "estimates"
                }`}
              </EstimateBadge>
            </p>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground">{copy.footnote}</p>
    </div>
  );
}

function LineRow<C extends string, L extends LineBase<C>, S extends string>({
  kind,
  line,
  index,
  columns,
  categories,
  categoryLabel,
  categoryHint,
  sourceColumn,
  descriptionPlaceholder,
  onCategory,
  onChange,
  onRemove,
}: {
  kind: "income" | "expense";
  line: L;
  index: number;
  columns: string;
  categories: readonly C[];
  categoryLabel: Record<C, string>;
  categoryHint: Record<C, string>;
  sourceColumn?: SourceColumn<L, S>;
  descriptionPlaceholder: string;
  onCategory: (category: C) => void;
  onChange: (patch: Partial<L>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  // "income line 2": both editors sit on one form, so every label says which.
  const lineName = `${kind} line ${index + 1}`;
  const lineTitle = `${kind === "income" ? "Income" : "Expense"} line ${index + 1}`;
  // In a narrow editor each control shows its own label; in a wide one the
  // column headings do, and the labels stay for screen readers.
  const cellLabel =
    "mb-1 block text-[11px] font-medium text-muted-foreground @4xl:sr-only";
  const amountInvalid =
    line.amount.trim() === "" && line.description.trim() !== "";
  const removeLabel = `Remove ${lineName}`;

  return (
    <li
      className={cn(
        "grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card p-2.5 @4xl:items-center @4xl:rounded-lg @4xl:border-transparent @4xl:bg-transparent @4xl:p-0 @4xl:px-1",
        columns
      )}
      data-testid={`event-${kind}-line-${index}`}
    >
      <div className={cn(!sourceColumn && "col-span-2 @4xl:col-span-1")}>
        <label htmlFor={`${id}-category`} className={cellLabel}>
          Category
          <span className="sr-only">, {lineName}</span>
        </label>
        <Select
          value={line.category}
          onValueChange={(v) => onCategory(v as C)}
        >
          <SelectTrigger id={`${id}-category`} size="md" className="w-full">
            {/* Just the label: the hints are for choosing, not for the row */}
            <SelectValue>
              {/* Ellipsis, not a hard clip, when a phone-width cell is tight */}
              <span className="min-w-0 truncate">
                {categoryLabel[line.category]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                <span>{categoryLabel[c]}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {categoryHint[c]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sourceColumn && (
        <div>
          <label htmlFor={`${id}-source`} className={cellLabel}>
            Paid by
            <span className="sr-only">, {lineName}</span>
          </label>
          <Select
            value={sourceColumn.value(line)}
            onValueChange={(v) => onChange(sourceColumn.patch(v as S))}
          >
            <SelectTrigger id={`${id}-source`} size="md" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceColumn.options.map((s) => (
                <SelectItem key={s} value={s}>
                  {sourceColumn.label[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="col-span-2 @4xl:col-span-1">
        <label htmlFor={`${id}-description`} className={cellLabel}>
          Description
          <span className="sr-only">, {lineName}</span>
        </label>
        <Input
          id={`${id}-description`}
          value={line.description}
          maxLength={120}
          onChange={(e) =>
            onChange({ description: e.target.value } as Partial<L>)
          }
          placeholder={descriptionPlaceholder}
        />
      </div>

      {/* Amount, GST and actual / estimate are one row on a line card, the
          way they're read: "$180, incl. GST, an estimate". Too narrow for
          that (a phone), amount takes a row, GST shares one with the bin and
          actual / estimate gets the last to itself. In the wide layout the
          wrapper dissolves and each takes its own column. */}
      <div className="col-span-2 flex flex-wrap items-end gap-2 @lg:flex-nowrap @4xl:contents">
        <div className="basis-full @lg:min-w-[8rem] @lg:flex-1 @lg:basis-auto @4xl:min-w-0">
          <label htmlFor={`${id}-amount`} className={cellLabel}>
            Amount
            <span className="sr-only">, {lineName}</span>
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
              onChange={(e) =>
                onChange({ amount: e.target.value } as Partial<L>)
              }
              placeholder="0.00"
              aria-invalid={amountInvalid || undefined}
              className={cn(
                "pl-7 text-right tabular-nums",
                // Pencilled in: dashed like the estimate badges.
                line.estimated &&
                  "border-dashed border-amber-500/80 bg-amber-50/50 dark:border-amber-500/60 dark:bg-amber-950/20"
              )}
            />
          </div>
        </div>

        {/* A field-height chip, so it sits in the row like the controls
            beside it rather than floating as a bare checkbox. */}
        <label
          htmlFor={`${id}-gst`}
          className={cn(
            "flex h-11 flex-1 cursor-pointer select-none items-center gap-2 rounded-xl border px-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 @lg:flex-none @4xl:px-2.5",
            line.gstIncluded
              ? "border-forest-500/20 bg-forest-500/5 font-medium text-foreground dark:border-cream-50/15 dark:bg-cream-50/5"
              : "border-forest-500/20 text-muted-foreground hover:text-foreground dark:border-cream-50/15"
          )}
        >
          <Checkbox
            id={`${id}-gst`}
            checked={line.gstIncluded}
            onCheckedChange={(checked) =>
              onChange({ gstIncluded: checked === true } as Partial<L>)
            }
            aria-label={`${lineTitle} includes GST`}
          />
          <span aria-hidden className="whitespace-nowrap">
            <span className="@4xl:hidden">Incl. GST</span>
            <span className="hidden @4xl:inline">Incl.</span>
          </span>
        </label>

        <fieldset
          className="order-last min-w-0 basis-full @lg:order-none @lg:basis-auto"
          aria-label={`Actual or estimate, ${lineName}`}
        >
          {/* The options say what they are; the wide layout's column
              heading names the pair. */}
          <legend className="sr-only">Actual or estimate</legend>
          <div className="flex h-11 rounded-xl border border-forest-500/20 bg-muted/40 p-1 dark:border-cream-50/15">
            {(
              [
                { estimated: false, label: "Actual" },
                { estimated: true, label: "Estimate" },
              ] as const
            ).map((option) => {
              const selected = line.estimated === option.estimated;
              return (
                <label
                  key={option.label}
                  className={cn(
                    "flex flex-1 cursor-pointer select-none items-center justify-center rounded-lg border px-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 @4xl:px-2",
                    !selected &&
                      "border-transparent text-muted-foreground hover:text-foreground",
                    selected &&
                      !option.estimated &&
                      "border-forest-500/20 bg-card font-medium text-foreground shadow-sm dark:border-cream-50/15 dark:bg-input/60",
                    selected &&
                      option.estimated &&
                      "border-dashed border-amber-500/80 bg-amber-50 font-medium text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-200"
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-status`}
                    className="sr-only"
                    checked={selected}
                    onChange={() =>
                      onChange({ estimated: option.estimated } as Partial<L>)
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={removeLabel}
          className="ml-auto h-11 w-11 shrink-0 text-muted-foreground hover:bg-red-50 hover:text-red-700 @4xl:ml-0 @4xl:h-9 @4xl:w-9 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
