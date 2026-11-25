"use client";

import { useEffect, useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import {
  ChefHat,
  ChevronDown,
  HandCoins,
  Plus,
  Receipt,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_KIND_META,
  FUNDRAISING_ACTIVITY_KINDS,
  eventProfit,
  profitLabel,
  summariseEventExpenses,
  summariseEventIncome,
  type EventExpenseSummary,
  type EventIncomeSummary,
  type EventProfit,
  type FundraisingActivityKind,
} from "@/lib/day-reports";
import { CountField, Field, SectionCard } from "@/components/day-report/fields";
import { EstimateBadge } from "@/components/day-report/estimate-badge";
import {
  EventExpenseEditor,
  EventIncomeEditor,
  EventProfitStatement,
  SectionTotal,
  isBlankLineDraft,
  type ExpenseDraft,
  type IncomeDraft,
} from "@/components/day-report/event-lines-editor";

/**
 * The day's fundraising activities: events and catering gigs, as many as
 * were run. Each is a panel with its own name, guests, income and expenses,
 * collapsed to a one-line summary when the admin is done with it.
 */

export const ACTIVITY_KIND_ICON: Record<
  FundraisingActivityKind,
  React.ComponentType<{ className?: string }>
> = {
  EVENT: Ticket,
  CATERING: ChefHat,
};

/** An activity as typed: pax and amounts stay strings until saved. */
export interface ActivityDraft {
  key: string;
  kind: FundraisingActivityKind;
  name: string;
  pax: string;
  income: IncomeDraft[];
  expenses: ExpenseDraft[];
}

let activitySeq = 0;

export function newActivityDraft(
  partial: Partial<Omit<ActivityDraft, "key">> = {}
): ActivityDraft {
  return {
    key: `activity-${++activitySeq}`,
    kind: partial.kind ?? "EVENT",
    name: partial.name ?? "",
    pax: partial.pax ?? "",
    income: partial.income ?? [],
    expenses: partial.expenses ?? [],
  };
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface ActivityTotals {
  income: EventIncomeSummary;
  expenses: EventExpenseSummary;
  profit: EventProfit;
  /** Any line behind the totals is an estimate. */
  estimated: boolean;
}

/** Totals over lines with an amount; a line still being typed is skipped. */
export function summariseActivityDrafts(
  activities: readonly Pick<ActivityDraft, "income" | "expenses">[]
): ActivityTotals {
  const priced = <L extends { amount: string }>(lines: L[]) =>
    lines
      .filter((line) => num(line.amount) !== null)
      .map((line) => ({ ...line, amount: num(line.amount) ?? 0 }));
  const income = summariseEventIncome(
    activities.flatMap((a) => priced(a.income))
  );
  const expenses = summariseEventExpenses(
    activities.flatMap((a) => priced(a.expenses))
  );
  return {
    income,
    expenses,
    profit: eventProfit(income, expenses),
    estimated: income.estimatedLines + expenses.estimatedLines > 0,
  };
}

/** Nothing typed in it at all: skipped on save rather than stored empty. */
export function isBlankActivityDraft(activity: ActivityDraft): boolean {
  return (
    activity.name.trim() === "" &&
    activity.pax.trim() === "" &&
    activity.income.every(isBlankLineDraft) &&
    activity.expenses.every(isBlankLineDraft)
  );
}

/** "Xero staff lunch", or "Unnamed catering gig" until it has a name. */
export function activityTitle(
  activity: Pick<ActivityDraft, "kind" | "name">
): string {
  return (
    activity.name.trim() || `Unnamed ${ACTIVITY_KIND_META[activity.kind].noun}`
  );
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

export function ActivityList({
  activities,
  onChange,
  dayTheme,
  primary,
}: {
  activities: ActivityDraft[];
  onChange: (activities: ActivityDraft[]) => void;
  /** The day's theme, offered as the name of the day's event. */
  dayTheme: string | null;
  /**
   * The activities are the whole report (an events & catering day), rather
   * than something extra on a service night or cafe day.
   */
  primary: boolean;
}) {
  // A lone activity opens ready to edit; a list starts as scannable
  // summaries. Activities added from here open.
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () =>
      new Set(activities.length === 1 ? activities.map((a) => a.key) : [])
  );
  const setOpen = (key: string, open: boolean) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const add = (kind: FundraisingActivityKind) => {
    // The day's theme ("Rotary fundraiser dinner") usually names its event.
    const themeFree =
      dayTheme !== null && !activities.some((a) => a.name.trim() === dayTheme);
    const activity = newActivityDraft({
      kind,
      name: kind === "EVENT" && themeFree ? dayTheme : "",
    });
    onChange([...activities, activity]);
    setOpen(activity.key, true);
  };

  // The list as it is now, for an Undo pressed after further edits.
  const latest = useRef(activities);
  useEffect(() => {
    latest.current = activities;
  }, [activities]);

  const update = (key: string, patch: Partial<ActivityDraft>) =>
    onChange(activities.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const remove = (activity: ActivityDraft) => {
    const index = activities.indexOf(activity);
    onChange(activities.filter((a) => a.key !== activity.key));
    if (isBlankActivityDraft(activity)) return;
    // Nothing is lost until Save, but a stray click shouldn't cost a retype.
    toast(`Removed ${activityTitle(activity)}`, {
      description: "It goes for good when you save the report.",
      action: {
        label: "Undo",
        onClick: () => {
          const now = latest.current;
          if (now.some((a) => a.key === activity.key)) return;
          onChange([...now.slice(0, index), activity, ...now.slice(index)]);
        },
      },
    });
  };

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      {(["CATERING", "EVENT"] as const).map((kind) => {
        const Icon = ACTIVITY_KIND_ICON[kind];
        return (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => add(kind)}
            className="gap-1.5 border-violet-300/80 text-violet-800 hover:bg-violet-50 hover:text-violet-900 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
            data-testid={`activity-add-${kind.toLowerCase()}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <Icon className="h-3.5 w-3.5" aria-hidden />
            Add {ACTIVITY_KIND_META[kind].noun}
          </Button>
        );
      })}
    </div>
  );

  if (activities.length === 0) {
    return primary ? (
      <div
        className="rounded-xl border border-dashed border-violet-300/70 bg-violet-50/40 px-4 py-8 text-center dark:border-violet-800/60 dark:bg-violet-950/20"
        data-testid="activities-empty"
      >
        <p className="text-sm font-medium text-foreground">
          What did the team run today?
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
          Add each catering gig and event on its own, with its income and
          costs. Add as many as you ran.
        </p>
        <div className="mt-4 flex justify-center">{addButtons}</div>
      </div>
    ) : (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3"
        data-testid="activities-empty"
      >
        <p className="text-sm text-muted-foreground">
          Ran a catering gig or an event today as well?
        </p>
        {addButtons}
      </div>
    );
  }

  return (
    <section aria-label="Events and catering" className="space-y-3">
      {!primary && (
        <h3 className="text-sm font-semibold text-foreground">
          Also today
          <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
            Kept out of koha
          </span>
        </h3>
      )}
      <ol className="space-y-3" data-testid="activities">
        {activities.map((activity, index) => (
          <ActivityPanel
            key={activity.key}
            activity={activity}
            index={index}
            open={openKeys.has(activity.key)}
            onOpenChange={(open) => setOpen(activity.key, open)}
            onChange={(patch) => update(activity.key, patch)}
            onRemove={() => remove(activity)}
          />
        ))}
      </ol>
      {addButtons}
    </section>
  );
}

function ActivityPanel({
  activity,
  index,
  open,
  onOpenChange,
  onChange,
  onRemove,
}: {
  activity: ActivityDraft;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<ActivityDraft>) => void;
  onRemove: () => void;
}) {
  const meta = ACTIVITY_KIND_META[activity.kind];
  const Icon = ACTIVITY_KIND_ICON[activity.kind];
  const totals = summariseActivityDrafts([activity]);
  const hasLines = activity.income.length > 0 || activity.expenses.length > 0;
  const pax = num(activity.pax);
  const title = activityTitle(activity);
  const bodyId = `${activity.key}-body`;
  const id = (field: string) => `${activity.key}-${field}`;

  return (
    <li
      className="overflow-hidden rounded-2xl border border-violet-200/80 bg-violet-50/30 dark:border-violet-900/60 dark:bg-violet-950/10"
      data-testid={`activity-${index}`}
      data-kind={activity.kind}
    >
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-l-2xl px-4 py-3 text-left hover:bg-violet-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 dark:hover:bg-violet-900/20"
          data-testid={`activity-${index}-toggle`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "line-clamp-2 font-medium break-words",
                activity.name.trim()
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
              data-testid={`activity-${index}-title`}
            >
              {title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {meta.label}
              {pax !== null && (
                <>
                  , {pax.toLocaleString("en-NZ")}{" "}
                  {activity.kind === "EVENT" ? "guests" : "people"}
                </>
              )}
            </span>
          </span>
          {hasLines && (
            <span className="hidden shrink-0 text-right sm:block">
              <span className="flex items-center justify-end gap-1.5 text-sm font-semibold tabular-nums text-foreground">
                {totals.estimated && <EstimateBadge label="Includes estimates" />}
                {NZD.format(totals.income.total)}
              </span>
              <span
                className={cn(
                  "block text-xs tabular-nums",
                  totals.profit.profit < 0
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-muted-foreground"
                )}
              >
                {profitLabel(totals.profit.profit, totals.estimated)}{" "}
                {NZD.format(totals.profit.profit)}
              </span>
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="h-10 w-10 shrink-0 text-muted-foreground hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          data-testid={`activity-${index}-remove`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div
          id={bodyId}
          className="space-y-4 border-t border-violet-200/80 bg-card px-4 py-5 dark:border-violet-900/60 sm:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)_10rem] sm:items-end">
            <Field htmlFor={id("kind")} label="Kind">
              <KindToggle
                id={id("kind")}
                value={activity.kind}
                onChange={(kind) => onChange({ kind })}
                testId={`activity-${index}-kind`}
              />
            </Field>
            <Field htmlFor={id("name")} label="Name">
              <Input
                id={id("name")}
                value={activity.name}
                maxLength={120}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder={meta.namePlaceholder}
                className="font-medium"
                data-testid={`activity-${index}-name`}
              />
            </Field>
            <CountField
              id={id("pax")}
              label={meta.paxLabel}
              value={activity.pax}
              onChange={(pax) => onChange({ pax })}
            />
          </div>

          <SectionCard
            icon={HandCoins}
            title="Income"
            tone="violet"
            action={
              <SectionTotal
                total={totals.income.total}
                estimated={totals.income.estimatedLines > 0}
              />
            }
          >
            <EventIncomeEditor
              lines={activity.income}
              onChange={(income) => onChange({ income })}
              summary={totals.income}
              noun={meta.noun}
            />
          </SectionCard>

          <SectionCard
            icon={Receipt}
            title="Expenses"
            tone="violet"
            action={
              <SectionTotal
                total={totals.expenses.total}
                estimated={totals.expenses.estimatedLines > 0}
              />
            }
          >
            <EventExpenseEditor
              lines={activity.expenses}
              onChange={(expenses) => onChange({ expenses })}
              summary={totals.expenses}
              noun={meta.noun}
            />
          </SectionCard>

          {hasLines && (
            <EventProfitStatement
              income={totals.income}
              expenses={totals.expenses}
              profit={totals.profit}
              estimated={totals.estimated}
              noun={meta.noun}
            />
          )}
        </div>
      )}
    </li>
  );
}

function KindToggle({
  id,
  value,
  onChange,
  testId,
}: {
  id: string;
  value: FundraisingActivityKind;
  onChange: (kind: FundraisingActivityKind) => void;
  testId: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      id={id}
      value={value}
      onValueChange={(v) => onChange(v as FundraisingActivityKind)}
      aria-label="Event or catering"
      orientation="horizontal"
      className="inline-flex h-11 w-full rounded-2xl border border-border/80 bg-muted/40 p-1 sm:w-auto"
      data-testid={testId}
    >
      {FUNDRAISING_ACTIVITY_KINDS.map((kind) => {
        const Icon = ACTIVITY_KIND_ICON[kind];
        return (
          <RadioGroupPrimitive.Item
            key={kind}
            value={kind}
            data-testid={`${testId}-${kind.toLowerCase()}`}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 data-[state=checked]:bg-violet-700 data-[state=checked]:text-white data-[state=checked]:shadow-sm data-[state=unchecked]:hover:text-foreground dark:data-[state=checked]:bg-violet-600 sm:flex-none"
          >
            <Icon className="h-4 w-4" aria-hidden />
            {ACTIVITY_KIND_META[kind].label}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
