"use client";

import { useState } from "react";
import {
  CalendarRange,
  HandCoins,
  MapPin,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";
import {
  ApexChart,
  ChartCard,
  ChartEmpty,
  SegmentedControl,
} from "./primitives";
import {
  baseOptions,
  type ChartTokens,
  compactCount,
  nzd,
  num,
  PALETTE,
} from "../_lib/chart-theme";

export function TabOverview({
  data,
  tokens,
  filterKey,
}: {
  data: RestaurantAnalyticsData;
  tokens: ChartTokens;
  filterKey: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GuestsTrend data={data} tokens={tokens} filterKey={filterKey} />
        </div>
        <KohaMix data={data} tokens={tokens} filterKey={filterKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <KohaTrend data={data} tokens={tokens} filterKey={filterKey} />
        </div>
        <YoYSummary data={data} />
      </div>

      <GuestsByLocation data={data} tokens={tokens} filterKey={filterKey} />
    </div>
  );
}

function GuestsTrend({
  data,
  tokens,
  filterKey,
}: {
  data: RestaurantAnalyticsData;
  tokens: ChartTokens;
  filterKey: string;
}) {
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const isWeekly = view === "weekly";
  const labels = isWeekly ? data.weeklyLabels : data.trendLabels;
  const current = isWeekly ? data.currentYearWeekly : data.currentYearTrend;
  const prev = isWeekly ? data.previousYearWeekly : data.previousYearTrend;
  const hasPrev = prev.some((v) => v > 0);

  return (
    <ChartCard
      title="Guests Trend"
      icon={TrendingUp}
      accent="text-emerald-600 dark:text-emerald-400"
      info={{
        title: "Guests Trend",
        description: "Guests served over time",
        body: (
          <>
            <p>
              Total guests served per {isWeekly ? "week" : "month"} across the
              selected locations.
            </p>
            <p>
              The <span className="font-medium">dashed line</span> overlays the
              same period last year to spot year-over-year movement.
            </p>
          </>
        ),
      }}
      action={
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
          ]}
        />
      }
    >
      {current.some((v) => v > 0) ? (
        <ApexChart
          key={`guests-${view}-${filterKey}`}
          type="area"
          height={300}
          options={{
            ...baseOptions(tokens),
            chart: { ...baseOptions(tokens).chart, type: "area" },
            xaxis: {
              categories: labels,
              tickAmount: isWeekly ? 12 : undefined,
              labels: { style: tokens.axisStyle },
              axisBorder: { show: false },
              axisTicks: { show: false },
            },
            yaxis: {
              labels: { formatter: compactCount, style: tokens.axisStyle },
              min: 0,
            },
            colors: [PALETTE.guests, PALETTE.target],
            stroke: { curve: "smooth", width: [2.5, 2], dashArray: [0, 5] },
            fill: {
              type: "gradient",
              gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.32,
                opacityTo: 0.02,
                stops: [0, 90, 100],
              },
            },
            markers: {
              size: isWeekly ? 0 : [3.5, 0],
              strokeWidth: 2,
              strokeColors: tokens.mode === "dark" ? "#0f1114" : "#fff",
              hover: { sizeOffset: 3 },
            },
            tooltip: {
              shared: true,
              y: { formatter: (v: number) => (v == null ? "" : `${num(v)} guests`) },
            },
            legend: { ...baseOptions(tokens).legend, show: hasPrev },
          }}
          series={[
            { name: "This year", data: current },
            ...(hasPrev ? [{ name: "Previous year", data: prev }] : []),
          ]}
        />
      ) : (
        <ChartEmpty message="No guest data for this period" />
      )}
    </ChartCard>
  );
}

function KohaMix({
  data,
  tokens,
  filterKey,
}: {
  data: RestaurantAnalyticsData;
  tokens: ChartTokens;
  filterKey: string;
}) {
  const s = data.serviceStats;
  const total = s.cash + s.eftpos + s.stripe;

  return (
    <ChartCard
      title="Koha by Method"
      icon={Wallet}
      accent="text-amber-600 dark:text-amber-400"
      info={{
        title: "Koha by Method",
        description: "How koha was collected",
        body: (
          <p>
            Breakdown of total koha across the three payment streams: cash,
            eftpos and Stripe.
          </p>
        ),
      }}
    >
      {total > 0 ? (
        <ApexChart
          key={`koha-mix-${filterKey}`}
          type="donut"
          height={300}
          options={{
            ...baseOptions(tokens),
            chart: { ...baseOptions(tokens).chart, type: "donut" },
            labels: ["Cash", "Eftpos", "Stripe"],
            colors: [PALETTE.cash, PALETTE.eftpos, PALETTE.stripe],
            stroke: { width: 0 },
            dataLabels: {
              enabled: true,
              formatter: (val: number) => `${Math.round(val)}%`,
              style: { fontFamily: "var(--font-jakarta)", fontSize: "11px" },
              dropShadow: { enabled: false },
            },
            legend: {
              ...baseOptions(tokens).legend,
              position: "bottom",
              horizontalAlign: "center",
            },
            tooltip: { y: { formatter: (v: number) => nzd(v ?? 0, 2) } },
            plotOptions: {
              pie: {
                donut: {
                  size: "64%",
                  labels: {
                    show: true,
                    total: {
                      show: true,
                      label: "Total koha",
                      fontFamily: "var(--font-jakarta)",
                      fontSize: "12px",
                      color: tokens.label,
                      formatter: () => nzd(total),
                    },
                    value: {
                      fontFamily: "var(--font-jakarta)",
                      fontWeight: 700,
                      formatter: (val: string) => nzd(Number(val)),
                    },
                  },
                },
              },
            },
          }}
          series={[s.cash, s.eftpos, s.stripe]}
        />
      ) : (
        <ChartEmpty message="No koha recorded yet" />
      )}
    </ChartCard>
  );
}

function KohaTrend({
  data,
  tokens,
  filterKey,
}: {
  data: RestaurantAnalyticsData;
  tokens: ChartTokens;
  filterKey: string;
}) {
  const [stack, setStack] = useState<"stacked" | "100%">("stacked");
  const is100 = stack === "100%";
  const showTarget = data.hasKohaTarget && !is100;

  return (
    <ChartCard
      title="Koha Trend"
      icon={HandCoins}
      accent="text-amber-600 dark:text-amber-400"
      info={{
        title: "Koha Trend",
        description: "Monthly koha collected, split by method",
        body: (
          <>
            <p>
              Total koha each month, split by method (cash, eftpos and Stripe).
            </p>
            <p>
              Switch to <span className="font-medium">100%</span> to see each
              method&rsquo;s share of the monthly total instead of dollars.
            </p>
            {data.hasKohaTarget && (
              <p>
                The <span className="font-medium">dashed line</span> is the koha
                target for the month (per-night target × service nights). Shown
                in the stacked view only.
              </p>
            )}
          </>
        ),
      }}
      action={
        <SegmentedControl
          value={stack}
          onChange={setStack}
          options={[
            { value: "stacked", label: "Stacked" },
            { value: "100%", label: "100%" },
          ]}
        />
      }
    >
      {data.kohaTrend.some((v) => v > 0) ? (
        <ApexChart
          key={`koha-trend-${filterKey}-${stack}`}
          type="line"
          height={300}
          options={{
            ...baseOptions(tokens),
            chart: {
              ...baseOptions(tokens).chart,
              type: "line",
              stacked: true,
              stackType: is100 ? "100%" : "normal",
            },
            xaxis: {
              categories: data.trendLabels,
              labels: { style: tokens.axisStyle },
              axisBorder: { show: false },
              axisTicks: { show: false },
            },
            yaxis: {
              labels: {
                formatter: (val: number) =>
                  is100
                    ? `${Math.round(val)}%`
                    : val >= 1000
                      ? `$${(val / 1000).toFixed(1)}k`
                      : `$${Math.round(val)}`,
                style: tokens.axisStyle,
              },
              min: 0,
              max: is100 ? 100 : undefined,
            },
            colors: [PALETTE.cash, PALETTE.eftpos, PALETTE.stripe, PALETTE.target],
            plotOptions: {
              bar: {
                columnWidth: "55%",
                borderRadius: 3,
                borderRadiusApplication: "end",
              },
            },
            stroke: {
              width: showTarget ? [0, 0, 0, 2.5] : [0, 0, 0],
              curve: "smooth",
              dashArray: showTarget ? [0, 0, 0, 5] : [0, 0, 0],
            },
            fill: { opacity: 1 },
            tooltip: {
              shared: true,
              y: { formatter: (v: number) => nzd(v ?? 0, 2) },
            },
          }}
          series={[
            { name: "Cash", type: "column", data: data.kohaStreamTrend.cash },
            { name: "Eftpos", type: "column", data: data.kohaStreamTrend.eftpos },
            { name: "Stripe", type: "column", data: data.kohaStreamTrend.stripe },
            ...(showTarget
              ? [{ name: "Target", type: "line", data: data.kohaTargetTrend }]
              : []),
          ]}
        />
      ) : (
        <ChartEmpty message="No koha recorded yet" />
      )}
    </ChartCard>
  );
}

function YoYSummary({ data }: { data: RestaurantAnalyticsData }) {
  const s = data.serviceStats;
  const metrics = [
    {
      label: "Guests served",
      current: data.summary.totalMeals,
      previous: data.summary.prevYearTotalMeals,
      fmt: (v: number) => num(v),
    },
    {
      label: "Avg per day",
      current: data.summary.avgPerDay,
      previous: data.summary.prevYearAvgPerDay,
      fmt: (v: number) => String(v),
    },
    {
      label: "Total koha",
      current: s.totalKoha,
      previous: s.prevTotalKoha,
      fmt: (v: number) => nzd(v),
    },
  ];

  return (
    <ChartCard
      title="Year over Year"
      icon={CalendarRange}
      accent="text-sky-600 dark:text-sky-400"
      bodyClassName="px-4"
    >
      {data.hasPreviousYearData ? (
        <div className="flex h-full flex-col justify-center gap-2 py-1">
          {metrics.map((mt) => {
            const diff = mt.current - mt.previous;
            const pct =
              mt.previous > 0 ? Math.round((diff / mt.previous) * 100) : 0;
            const positive = diff > 0;
            return (
              <div
                key={mt.label}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5"
              >
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {mt.label}
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {mt.fmt(mt.current)}
                  </p>
                </div>
                {mt.previous > 0 ? (
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        positive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : diff < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {pct}%
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      was {mt.fmt(mt.previous)}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    no prior data
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ChartEmpty message="No prior-year data to compare" />
      )}
    </ChartCard>
  );
}

function GuestsByLocation({
  data,
  tokens,
  filterKey,
}: {
  data: RestaurantAnalyticsData;
  tokens: ChartTokens;
  filterKey: string;
}) {
  return (
    <ChartCard
      title="Guests by Location"
      icon={MapPin}
      accent="text-emerald-600 dark:text-emerald-400"
      info={{
        title: "Guests by Location",
        description: "Year-over-year comparison by location",
        body: (
          <>
            <p>
              Compares total guests served at each location with the same period
              last year.
            </p>
            <p>
              The <span className="font-medium">dot marker</span> shows last
              year&rsquo;s total for each location.
            </p>
          </>
        ),
      }}
    >
      {data.locationBreakdown.length > 0 ? (
        <ApexChart
          key={`loc-${filterKey}`}
          type="bar"
          height={Math.max(260, data.locationBreakdown.length * 76)}
          options={{
            ...baseOptions(tokens),
            chart: { ...baseOptions(tokens).chart, type: "bar" },
            plotOptions: {
              bar: {
                horizontal: true,
                borderRadius: 4,
                borderRadiusApplication: "end",
                barHeight: "58%",
              },
            },
            xaxis: {
              categories: data.locationBreakdown.map((l) => l.location),
              labels: {
                formatter: (val: string) => {
                  const n = Number(val);
                  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : val;
                },
                style: tokens.axisStyle,
              },
            },
            yaxis: { labels: { style: tokens.catStyle } },
            colors: [PALETTE.guests],
            dataLabels: {
              enabled: true,
              formatter: (val: number) => (val > 0 ? num(val) : ""),
              style: {
                fontFamily: "var(--font-jakarta)",
                fontSize: "11px",
                fontWeight: 600,
                colors: ["#fff"],
              },
              offsetX: -2,
            },
            grid: {
              ...baseOptions(tokens).grid,
              yaxis: { lines: { show: false } },
            },
            legend: { show: false },
            tooltip: {
              shared: true,
              intersect: false,
              custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                const loc = data.locationBreakdown[dataPointIndex];
                if (!loc) return "";
                const diff = loc.totalMeals - loc.prevYearMeals;
                const diffLabel =
                  loc.prevYearMeals > 0
                    ? diff > 0
                      ? `<span style="color:#10b981">+${num(diff)} vs last year</span>`
                      : diff < 0
                        ? `<span style="color:#ef4444">${num(diff)} vs last year</span>`
                        : `<span style="color:#64748b">No change</span>`
                    : "";
                return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                  <b>${loc.location}</b><br/>
                  This year: <b>${num(loc.totalMeals)}</b><br/>
                  ${loc.prevYearMeals > 0 ? `Last year: ${num(loc.prevYearMeals)}<br/>${diffLabel}<br/>` : ""}
                  Avg: ${loc.avgPerDay}/day
                </div>`;
              },
            },
            annotations: data.hasPreviousYearData
              ? {
                  points: data.locationBreakdown
                    .filter((l) => l.prevYearMeals > 0)
                    .map((l) => ({
                      x: l.prevYearMeals,
                      y: l.location as unknown as number,
                      marker: {
                        size: 5,
                        fillColor: PALETTE.target,
                        strokeColor: tokens.mode === "dark" ? "#0f1114" : "#fff",
                        strokeWidth: 2,
                        shape: "circle",
                      },
                      label: {
                        text: "Last yr: " + num(l.prevYearMeals),
                        borderWidth: 0,
                        style: {
                          fontSize: "9px",
                          fontFamily: "var(--font-jakarta)",
                          color: tokens.label,
                          background: "transparent",
                          padding: { left: 4, right: 4, top: 1, bottom: 1 },
                        },
                      },
                    })),
                }
              : undefined,
          }}
          series={[
            {
              name: "This year",
              data: data.locationBreakdown.map((l) => l.totalMeals),
            },
          ]}
        />
      ) : (
        <ChartEmpty message="No location data available" />
      )}
    </ChartCard>
  );
}
