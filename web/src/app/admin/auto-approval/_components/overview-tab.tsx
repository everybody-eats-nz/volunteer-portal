"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  Clock,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import type { ApexOptions } from "apexcharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/ui/stats-card";
import { cn } from "@/lib/utils";
import { formatInNZT } from "@/lib/timezone";
import {
  ApexChart,
  ChartErrorBoundary,
  ChartSkeleton,
  SegmentedControl,
} from "@/app/admin/analytics/_components/primitives";
import {
  animationsEnabled,
  baseOptions,
  chartTokens,
  FONT,
} from "@/app/admin/analytics/_lib/chart-theme";

import { EmptyState, VolunteerCell } from "./shared";
import { OUTCOME_META, OutcomeBadge, type Outcome } from "./outcome";

interface Overview {
  windowDays: number;
  totals: {
    total: number;
    approved: number;
    held: number;
    blocked: number;
    errored: number;
  };
  autoApprovalRate: number;
  overrides: number;
  series: { date: string; approved: number; held: number; blocked: number }[];
  byRule: {
    ruleId: string | null;
    ruleName: string;
    outcome: Outcome;
    count: number;
  }[];
  byLocation: { location: string; approved: number; total: number }[];
  ruleHealth: {
    enabled: number;
    disabled: number;
    blocking: number;
    inert: { id: string; name: string }[];
  };
  recent: {
    id: string;
    createdAt: string;
    outcome: Outcome;
    ruleName: string | null;
    summary: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
    shift: {
      start: string;
      location: string | null;
      shiftType: { name: string } | null;
    };
  }[];
}

const WINDOWS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

export function OverviewTab({ onJumpToDecisions }: { onJumpToDecisions: () => void }) {
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/auto-approval/overview?days=${days}`);
      setData(res.ok ? await res.json() : null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const tokens = useMemo(
    () => chartTokens(resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme]
  );

  const chart = useMemo<{
    options: ApexOptions;
    series: { name: string; data: number[] }[];
  }>(() => {
    const series = data?.series ?? [];
    return {
      options: {
        ...baseOptions(tokens),
        chart: {
          type: "bar",
          stacked: true,
          toolbar: { show: false },
          fontFamily: FONT,
          animations: { enabled: animationsEnabled() },
          background: "transparent",
        },
        colors: [
          OUTCOME_META.APPROVED.hex,
          OUTCOME_META.HELD.hex,
          OUTCOME_META.BLOCKED.hex,
        ],
        plotOptions: { bar: { columnWidth: "60%", borderRadius: 2 } },
        dataLabels: { enabled: false },
        legend: { show: true, position: "top", horizontalAlign: "left" },
        grid: { borderColor: tokens.grid, strokeDashArray: 4 },
        xaxis: {
          categories: series.map((d) => d.date),
          type: "category",
          tickAmount: 6,
          labels: {
            style: tokens.catStyle,
            // 30 day-labels never fit flat at this width; angled and thinned
            // out is the only way they stay readable.
            rotate: -45,
            rotateAlways: true,
            hideOverlappingLabels: true,
            formatter: (v: string) =>
              v ? formatInNZT(new Date(`${v}T00:00:00Z`), "d MMM") : "",
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          labels: { style: tokens.axisStyle, formatter: (v: number) => String(Math.round(v)) },
        },
        tooltip: { theme: tokens.mode },
      },
      series: [
        { name: "Approved", data: series.map((d) => d.approved) },
        { name: "Held", data: series.map((d) => d.held) },
        { name: "Blocked", data: series.map((d) => d.blocked) },
      ],
    };
  }, [data, tokens]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <ChartSkeleton height={320} />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <EmptyState icon={TriangleAlert} title="Couldn't load the overview">
          Refresh the page to try again.
        </EmptyState>
      </Card>
    );
  }

  const { totals, ruleHealth } = data;
  const hasActivity = totals.total > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everything the rules decided in the last {data.windowDays} days.
        </p>
        <SegmentedControl
          value={days}
          onChange={setDays}
          options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
        />
      </div>

      {ruleHealth.inert.length > 0 && (
        <Alert variant="destructive" data-testid="inert-rules-alert">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>
            {ruleHealth.inert.length} rule
            {ruleHealth.inert.length === 1 ? "" : "s"} can never match anyone
          </AlertTitle>
          <AlertDescription>
            {ruleHealth.inert.map((r) => r.name).join(", ")} — no conditions are
            set, so the rule is switched on but does nothing. Add a condition or
            archive it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Approved automatically"
          value={totals.approved}
          subtitle={
            hasActivity
              ? `${Math.round(data.autoApprovalRate)}% of all signups`
              : "No signups yet in this window"
          }
          icon={CheckCircle2}
          variant="green"
          testId="stat-approved"
        />
        <StatsCard
          title="Held for a person"
          value={totals.held}
          subtitle="Waiting on manual approval"
          icon={Clock}
          variant="amber"
          testId="stat-held"
        />
        <StatsCard
          title="Blocked"
          value={totals.blocked}
          subtitle={`${ruleHealth.blocking} block rule${ruleHealth.blocking === 1 ? "" : "s"} active`}
          icon={CircleSlash}
          variant="red"
          testId="stat-blocked"
        />
        <StatsCard
          title="Overridden later"
          value={data.overrides}
          subtitle="Auto-approvals an admin reversed"
          icon={RotateCcw}
          variant="purple"
          testId="stat-overrides"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What the rules did</CardTitle>
          <CardDescription>
            Daily outcomes. A rising amber band means more signups are landing on
            the team instead of clearing themselves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasActivity ? (
            <ChartErrorBoundary>
              <ApexChart
                type="bar"
                height={300}
                options={chart.options}
                series={chart.series}
              />
            </ChartErrorBoundary>
          ) : (
            <EmptyState icon={Activity} title="Nothing decided yet">
              Once volunteers start signing up, every decision the rules make
              shows up here.
            </EmptyState>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Which rules are doing the work</CardTitle>
            <CardDescription>
              A rule near zero is either too strict or shadowed by a
              higher-priority one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.byRule.length === 0 ? (
              <EmptyState icon={Activity} title="No rule has fired yet" />
            ) : (
              <ul className="space-y-3">
                {data.byRule.map((rule) => {
                  const max = Math.max(...data.byRule.map((r) => r.count), 1);
                  return (
                    <li key={rule.ruleId ?? rule.ruleName} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              OUTCOME_META[rule.outcome].dot
                            )}
                            aria-hidden
                          />
                          <span className="truncate text-sm font-medium">
                            {rule.ruleName}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {OUTCOME_META[rule.outcome].label.toLowerCase()}
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {rule.count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            OUTCOME_META[rule.outcome].dot
                          )}
                          style={{ width: `${(rule.count / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By location</CardTitle>
            <CardDescription>
              How much each restaurant is clearing without help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.byLocation.length === 0 ? (
              <EmptyState icon={Activity} title="No decisions yet" />
            ) : (
              <ul className="space-y-3">
                {data.byLocation.map((loc) => {
                  const pct = loc.total ? (loc.approved / loc.total) * 100 : 0;
                  return (
                    <li key={loc.location} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {loc.location}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {Math.round(pct)}% of {loc.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Latest decisions</CardTitle>
            <CardDescription>
              The most recent calls the rules made.
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={onJumpToDecisions}
            className="shrink-0 text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            See all
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent.length === 0 ? (
            <EmptyState icon={Activity} title="No decisions yet" />
          ) : (
            <ul className="divide-y">
              {data.recent.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 px-6 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <VolunteerCell
                      volunteer={d.user}
                      subtitle={`${d.shift.shiftType?.name ?? "Shift"} · ${formatInNZT(new Date(d.shift.start), "EEE d MMM")}`}
                    />
                  </div>
                  <span className="hidden max-w-xs truncate text-xs text-muted-foreground md:block">
                    {d.summary}
                  </span>
                  <OutcomeBadge outcome={d.outcome} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
