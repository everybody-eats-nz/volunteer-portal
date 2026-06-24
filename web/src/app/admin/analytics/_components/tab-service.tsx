"use client";

import { Beef, CloudSun, UserPlus } from "lucide-react";
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";
import type { RestaurantReports } from "@/lib/restaurant-reports";
import { ServiceNightsTable } from "@/components/service-nights-table";
import { ApexChart, ChartCard, ChartEmpty } from "./primitives";
import {
  baseOptions,
  type ChartTokens,
  compactCount,
  num,
  PALETTE,
  SERIES_COLORS,
} from "../_lib/chart-theme";
import type { FilterState } from "./filter-bar";

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return `${d.toLocaleDateString("en-NZ", { month: "short" })} '${y.slice(2)}`;
}

export function TabService({
  data,
  reports,
  tokens,
  filterKey,
  applied,
}: {
  data: RestaurantAnalyticsData;
  reports: RestaurantReports;
  tokens: ChartTokens;
  filterKey: string;
  applied: FilterState;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MixBar
          title="Protein Mix"
          icon={Beef}
          accent="text-rose-600 dark:text-rose-400"
          rows={data.proteinMix}
          tokens={tokens}
          filterKey={`protein-${filterKey}`}
          distributed
          emptyMsg="No protein data yet"
        />
        <MixBar
          title="Weather Mix"
          icon={CloudSun}
          accent="text-sky-600 dark:text-sky-400"
          rows={data.weatherMix}
          tokens={tokens}
          filterKey={`weather-${filterKey}`}
          emptyMsg="No weather data yet"
        />
      </div>

      <NewVolunteersByLocation reports={reports} tokens={tokens} />

      <ServiceNightsTable
        months={applied.months}
        location={applied.location}
        days={applied.days}
        from={applied.from}
        to={applied.to}
      />
    </div>
  );
}

function MixBar({
  title,
  icon,
  accent,
  rows,
  tokens,
  filterKey,
  distributed = false,
  emptyMsg,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  rows: Array<{ label: string; nights: number }>;
  tokens: ChartTokens;
  filterKey: string;
  distributed?: boolean;
  emptyMsg: string;
}) {
  return (
    <ChartCard title={title} icon={icon} accent={accent}>
      {rows.length > 0 ? (
        <ApexChart
          key={filterKey}
          type="bar"
          height={Math.max(240, rows.length * 42)}
          options={{
            ...baseOptions(tokens),
            chart: { ...baseOptions(tokens).chart, type: "bar" },
            plotOptions: {
              bar: {
                horizontal: true,
                borderRadius: 4,
                borderRadiusApplication: "end",
                barHeight: "62%",
                distributed,
              },
            },
            colors: distributed ? SERIES_COLORS : [PALETTE.eftpos],
            xaxis: {
              categories: rows.map((r) => r.label),
              labels: { style: tokens.axisStyle },
            },
            yaxis: { labels: { style: tokens.catStyle } },
            dataLabels: {
              enabled: true,
              formatter: (val: number) => String(val),
              style: {
                fontFamily: "var(--font-jakarta)",
                fontSize: "11px",
                fontWeight: 600,
                colors: ["#fff"],
              },
            },
            grid: { ...baseOptions(tokens).grid, yaxis: { lines: { show: false } } },
            legend: { show: false },
            tooltip: {
              y: { formatter: (val: number) => `${val} night${val === 1 ? "" : "s"}` },
            },
          }}
          series={[{ name: "Nights", data: rows.map((r) => r.nights) }]}
        />
      ) : (
        <ChartEmpty message={emptyMsg} height={240} />
      )}
    </ChartCard>
  );
}

function NewVolunteersByLocation({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  const series = reports.newVolByLocation.series;
  return (
    <ChartCard
      title="New Volunteers by Location"
      icon={UserPlus}
      accent="text-violet-600 dark:text-violet-400"
      info={{
        title: "New Volunteers by Location",
        description: "First-time volunteers recorded each month, per location",
        body: (
          <p>
            Monthly count of first-time volunteers, broken out by location, from
            recorded service nights.
          </p>
        ),
      }}
    >
      {series.length > 0 ? (
        <ApexChart
          key={`nv-${reports.monthLabels.length}`}
          type="line"
          height={320}
          options={{
            ...baseOptions(tokens),
            chart: { ...baseOptions(tokens).chart, type: "line" },
            colors: SERIES_COLORS,
            xaxis: {
              categories: reports.monthLabels.map(fmtMonth),
              tickAmount: 12,
              labels: { style: tokens.axisStyle },
              axisBorder: { show: false },
              axisTicks: { show: false },
            },
            yaxis: {
              labels: { formatter: compactCount, style: tokens.axisStyle },
              min: 0,
            },
            stroke: { curve: "smooth", width: 2 },
            markers: { size: 0 },
            tooltip: { y: { formatter: (v: number) => num(Math.round(v ?? 0)) } },
          }}
          series={series.map((s) => ({ name: s.location, data: s.data }))}
        />
      ) : (
        <ChartEmpty message="No new-volunteer data" />
      )}
    </ChartCard>
  );
}
