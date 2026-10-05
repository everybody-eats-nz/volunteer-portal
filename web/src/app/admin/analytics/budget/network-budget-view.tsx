"use client";

import { motion } from "motion/react";
import { Pencil, Target } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import {
  budgetStatus,
  ratioToPercent,
} from "@/lib/budget-calculations";
import type {
  BudgetTrackingData,
  LocationBudgetSummary,
} from "@/lib/budget-tracking";
import { money0 } from "../_lib/chart-theme";
import { BudgetProgressBar, StatusPill } from "./budget-status";

export function NetworkBudgetView({
  data,
  onOpenLocation,
  onEditBudget,
}: {
  data: BudgetTrackingData;
  onOpenLocation: (location: string) => void;
  onEditBudget: (summary: LocationBudgetSummary) => void;
}) {
  const { totals } = data;
  const ytdRatio = totals.ytdTarget > 0 ? totals.ytdActual / totals.ytdTarget : null;
  const ytdStatus =
    totals.ytdTarget > 0 ? budgetStatus(totals.ytdActual, totals.ytdTarget) : null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {totals.budgetedLocations > 0 && (
        <motion.section
          variants={staggerItem}
          className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
          data-testid="budget-network-summary"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All restaurants · {data.year}
              </p>
              <h2 className="mt-1 font-accent text-2xl font-semibold leading-tight">
                {money0(totals.ytdActual)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  banked of {money0(totals.annualTarget)} combined budget
                </span>
              </h2>
            </div>
            {ytdStatus && ytdRatio !== null && (
              <StatusPill
                status={ytdStatus}
                label={`${ratioToPercent(ytdRatio)}% of pro-rata target`}
                className="text-sm"
              />
            )}
          </div>
          <div className="mt-4">
            <BudgetProgressBar
              annualRatio={
                totals.annualTarget > 0 ? totals.ytdActual / totals.annualTarget : 0
              }
              proRataRatio={
                totals.annualTarget > 0 ? totals.ytdTarget / totals.annualTarget : 0
              }
              status={ytdStatus}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {totals.nightsHeld} of {totals.plannedServiceNights} planned nights
              held across {totals.budgetedLocations}{" "}
              {totals.budgetedLocations === 1 ? "restaurant" : "restaurants"}{" "}
              with a budget · pro-rata target {money0(totals.ytdTarget)}
            </p>
          </div>
        </motion.section>
      )}

      <motion.ul
        variants={staggerItem}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {data.locations.map((summary) => (
          <li key={summary.locationId} className="list-none">
            {summary.progress ? (
              <BudgetCard
                summary={summary}
                timing={data.timing}
                onOpen={() => onOpenLocation(summary.location)}
                onEdit={() => onEditBudget(summary)}
              />
            ) : (
              <UnbudgetedCard
                summary={summary}
                year={data.year}
                onSet={() => onEditBudget(summary)}
              />
            )}
          </li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

function BudgetCard({
  summary,
  timing,
  onOpen,
  onEdit,
}: {
  summary: LocationBudgetSummary;
  timing: BudgetTrackingData["timing"];
  onOpen: () => void;
  onEdit: () => void;
}) {
  const p = summary.progress!;
  const status = p.budgetMet ? "green" : p.ytdStatus;
  const proRataRatio = p.annualTarget > 0 ? p.ytdTarget / p.annualTarget : 0;

  let needed: string;
  if (p.budgetMet) needed = "Budget met";
  else if (timing === "past") needed = `${money0(p.remainingTarget)} short`;
  else if (p.avgNeededPerRemaining === null) needed = "No nights left";
  else needed = money0(p.avgNeededPerRemaining);

  return (
    <article
      className="group relative flex h-full flex-col rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
      data-testid={`budget-card-${summary.location}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col gap-4 rounded-xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${summary.location} budget tracking`}
      >
        <div className="flex items-start justify-between gap-2 pr-9">
          <h3 className="font-accent text-lg font-semibold leading-tight">
            {summary.location}
          </h3>
          <StatusPill
            status={status}
            label={
              p.budgetMet
                ? "Budget met"
                : p.ytdRatio !== null
                  ? `${ratioToPercent(p.ytdRatio)}% of pro-rata`
                  : "Not started"
            }
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-semibold tabular-nums">{money0(p.ytdActual)}</span>{" "}
              <span className="text-muted-foreground">of {money0(p.annualTarget)}</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {ratioToPercent(p.annualRatio ?? 0)}%
            </span>
          </div>
          <BudgetProgressBar
            annualRatio={p.annualRatio ?? 0}
            proRataRatio={proRataRatio}
            status={status}
            size="sm"
          />
        </div>

        <dl className="mt-auto grid grid-cols-3 gap-3 border-t pt-3">
          <Stat label="Pro-rata" value={money0(p.ytdTarget)} />
          <Stat
            label={timing === "past" ? "Result" : "Need / night"}
            value={needed}
          />
          <Stat
            label="Nights"
            value={`${p.nightsHeld}/${p.plannedServiceNights}`}
          />
        </dl>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-8 w-8 text-muted-foreground"
        onClick={onEdit}
        aria-label={`Edit ${summary.location} budget`}
        data-testid={`budget-card-edit-${summary.location}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function UnbudgetedCard({
  summary,
  year,
  onSet,
}: {
  summary: LocationBudgetSummary;
  year: number;
  onSet: () => void;
}) {
  return (
    <article
      className="flex h-full flex-col justify-between gap-4 rounded-xl border border-dashed bg-card/50 p-5"
      data-testid={`budget-card-${summary.location}`}
    >
      <div>
        <h3 className="font-accent text-lg font-semibold leading-tight text-muted-foreground">
          {summary.location}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No {year} budget yet, so nights aren&rsquo;t scored.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={onSet}
        data-testid={`budget-card-set-${summary.location}`}
      >
        <Target className="h-4 w-4" />
        Set {year} budget
      </Button>
    </article>
  );
}
