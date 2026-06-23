"use client";

import { useState } from "react";
import {
  CalendarRange,
  HandCoins,
  Scaling,
  TableProperties,
  TrendingUp,
  Users,
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RestaurantReports } from "@/lib/restaurant-reports";
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
  compactMoney,
  money0,
  money2,
  num,
  oneDp,
  PALETTE,
} from "../_lib/chart-theme";

const NZD2 = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return `${d.toLocaleDateString("en-NZ", { month: "short" })} '${y.slice(2)}`;
}

const METRICS = [
  { key: "koha", label: "Total koha", money: true, color: PALETTE.koha, chart: "area" },
  { key: "perHead", label: "$ per head", money: true, color: PALETTE.guests, chart: "line" },
  { key: "customers", label: "Customers", money: false, color: PALETTE.eftpos, chart: "area" },
  { key: "avgCustomers", label: "Avg customers / night", money: false, color: "#0ea5e9", chart: "line" },
  { key: "avgKohaPerNight", label: "Avg koha / night", money: true, color: PALETTE.koha, chart: "line" },
  { key: "nights", label: "Record count", money: false, color: PALETTE.target, chart: "bar" },
  { key: "newVolunteers", label: "New volunteers", money: false, color: PALETTE.volunteers, chart: "bar" },
  { key: "bookings", label: "Bookings", money: false, color: PALETTE.bookings, chart: "area" },
] as const;

export function TabDonations({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  if (!reports.hasData) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No donation records for this period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MetricTrends reports={reports} tokens={tokens} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PayingVsNonPaying reports={reports} tokens={tokens} />
        <CustomersVsBookings reports={reports} tokens={tokens} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PerHeadByWeekday reports={reports} tokens={tokens} />
        <BookingsScatter reports={reports} tokens={tokens} />
      </div>

      <SummaryByLocation reports={reports} />
    </div>
  );
}

function MetricTrends({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("koha");
  const [gran, setGran] = useState<"monthly" | "yearly">("monthly");
  const m = METRICS.find((x) => x.key === metric)!;
  const labels =
    gran === "monthly" ? reports.monthLabels.map(fmtMonth) : reports.yearLabels;
  const series = (gran === "monthly" ? reports.monthly : reports.yearly)[
    metric
  ] as (number | null)[];

  return (
    <ChartCard
      title="Metric Trends"
      icon={TrendingUp}
      accent="text-blue-600 dark:text-blue-400"
      action={
        <div className="flex items-center gap-2">
          <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <SelectTrigger size="sm" className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SegmentedControl
            value={gran}
            onChange={setGran}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </div>
      }
    >
      <ApexChart
        key={`metric-${metric}-${gran}-${labels.length}`}
        type={m.chart}
        height={320}
        options={{
          ...baseOptions(tokens),
          chart: { ...baseOptions(tokens).chart, type: m.chart },
          colors: [m.color],
          xaxis: {
            categories: labels,
            tickAmount: gran === "monthly" ? Math.min(12, labels.length) : undefined,
            labels: { style: tokens.axisStyle, rotate: 0 },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          yaxis: {
            labels: {
              formatter: m.money ? compactMoney : compactCount,
              style: tokens.axisStyle,
            },
            min: 0,
          },
          stroke: { curve: "smooth", width: m.chart === "bar" ? 0 : 2.5 },
          fill:
            m.chart === "area"
              ? {
                  type: "gradient",
                  gradient: { opacityFrom: 0.32, opacityTo: 0.02, stops: [0, 90, 100] },
                }
              : { opacity: 1 },
          plotOptions: { bar: { borderRadius: 3, columnWidth: "60%" } },
          markers: { size: 0, hover: { sizeOffset: 3 } },
          legend: { show: false },
          tooltip: {
            y: {
              formatter: (v: number) =>
                v == null ? "—" : m.money ? NZD2.format(v) : num(Math.round(v)),
            },
          },
        }}
        series={[{ name: m.label, data: series.map((v) => v ?? 0) }]}
      />
    </ChartCard>
  );
}

function PayingVsNonPaying({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  const [stack, setStack] = useState<"stacked" | "100%">("stacked");
  const is100 = stack === "100%";
  return (
    <ChartCard
      title="Paying vs Non-paying"
      icon={Users}
      accent="text-rose-600 dark:text-rose-400"
      action={
        <SegmentedControl
          value={stack}
          onChange={setStack}
          options={[
            { value: "stacked", label: "Count" },
            { value: "100%", label: "Share" },
          ]}
        />
      }
    >
      <ApexChart
        key={`pay-${reports.monthLabels.length}-${stack}`}
        type="bar"
        height={300}
        options={{
          ...baseOptions(tokens),
          chart: {
            ...baseOptions(tokens).chart,
            type: "bar",
            stacked: true,
            stackType: is100 ? "100%" : "normal",
          },
          colors: [PALETTE.positive, PALETTE.negative],
          xaxis: {
            categories: reports.monthLabels.map(fmtMonth),
            tickAmount: 12,
            labels: { style: tokens.axisStyle },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          yaxis: {
            labels: {
              formatter: is100 ? (v: number) => `${Math.round(v)}%` : compactCount,
              style: tokens.axisStyle,
            },
            max: is100 ? 100 : undefined,
          },
          plotOptions: { bar: { columnWidth: "70%" } },
          tooltip: {
            shared: true,
            intersect: false,
            y: { formatter: (v: number) => num(Math.round(v ?? 0)) },
          },
        }}
        series={[
          { name: "Paying", data: reports.monthly.paying },
          { name: "Non-paying", data: reports.monthly.nonPaying },
        ]}
      />
    </ChartCard>
  );
}

function CustomersVsBookings({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  return (
    <ChartCard
      title="Customers vs Bookings"
      icon={CalendarRange}
      accent="text-sky-600 dark:text-sky-400"
    >
      <ApexChart
        key={`cb-${reports.monthLabels.length}`}
        type="line"
        height={300}
        options={{
          ...baseOptions(tokens),
          chart: { ...baseOptions(tokens).chart, type: "line" },
          colors: [PALETTE.eftpos, PALETTE.bookings],
          xaxis: {
            categories: reports.monthLabels.map(fmtMonth),
            tickAmount: 12,
            labels: { style: tokens.axisStyle },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          yaxis: [
            {
              seriesName: "Customers",
              labels: { formatter: compactCount, style: tokens.axisStyle },
              title: {
                text: "Customers",
                style: { fontFamily: "var(--font-jakarta)", fontSize: "11px", color: tokens.label },
              },
            },
            {
              seriesName: "Bookings",
              opposite: true,
              labels: { formatter: compactCount, style: tokens.axisStyle },
              title: {
                text: "Bookings",
                style: { fontFamily: "var(--font-jakarta)", fontSize: "11px", color: tokens.label },
              },
            },
          ],
          stroke: { curve: "smooth", width: 2.5 },
          markers: { size: 0 },
        }}
        series={[
          { name: "Customers", data: reports.monthly.customers },
          { name: "Bookings", data: reports.monthly.bookings },
        ]}
      />
    </ChartCard>
  );
}

function PerHeadByWeekday({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  return (
    <ChartCard
      title="$ per Head by Day of Week"
      icon={Scaling}
      accent="text-amber-600 dark:text-amber-400"
    >
      <ApexChart
        key={`wd-${reports.monthLabels.length}`}
        type="bar"
        height={300}
        options={{
          ...baseOptions(tokens),
          chart: { ...baseOptions(tokens).chart, type: "bar" },
          colors: [PALETTE.koha],
          plotOptions: {
            bar: {
              horizontal: true,
              borderRadius: 4,
              borderRadiusApplication: "end",
              barHeight: "62%",
            },
          },
          xaxis: {
            categories: reports.weekday.map((w) => w.day),
            labels: {
              formatter: (v: string) => `$${Number(v).toFixed(1)}`,
              style: tokens.axisStyle,
            },
          },
          yaxis: { labels: { style: tokens.catStyle } },
          dataLabels: {
            enabled: true,
            formatter: (v: number) => (v ? NZD2.format(v) : ""),
            style: {
              fontFamily: "var(--font-jakarta)",
              fontSize: "11px",
              fontWeight: 600,
              colors: ["#fff"],
            },
          },
          grid: { ...baseOptions(tokens).grid, yaxis: { lines: { show: false } } },
          tooltip: { y: { formatter: (v: number) => money2(v ?? 0) } },
        }}
        series={[{ name: "$ / head", data: reports.weekday.map((w) => w.perHead ?? 0) }]}
      />
    </ChartCard>
  );
}

function BookingsScatter({
  reports,
  tokens,
}: {
  reports: RestaurantReports;
  tokens: ChartTokens;
}) {
  return (
    <ChartCard
      title="Bookings → Donations"
      icon={HandCoins}
      accent="text-amber-600 dark:text-amber-400"
      info={{
        title: "Bookings → Donations",
        description: "Relationship between bookings and koha",
        body: (
          <p>
            Each dot is one service night, plotting its number of bookings
            against the koha collected.
          </p>
        ),
      }}
    >
      {reports.scatter.length > 0 ? (
        <ApexChart
          key={`scatter-${reports.scatter.length}`}
          type="scatter"
          height={300}
          options={{
            ...baseOptions(tokens),
            chart: {
              ...baseOptions(tokens).chart,
              type: "scatter",
              zoom: { enabled: false },
            },
            colors: [PALETTE.eftpos],
            xaxis: {
              type: "numeric",
              tickAmount: 10,
              title: {
                text: "Bookings",
                style: { fontFamily: "var(--font-jakarta)", fontSize: "11px", color: tokens.label },
              },
              labels: { style: tokens.axisStyle },
            },
            yaxis: {
              labels: { formatter: compactMoney, style: tokens.axisStyle },
              title: {
                text: "Total koha",
                style: { fontFamily: "var(--font-jakarta)", fontSize: "11px", color: tokens.label },
              },
            },
            markers: { size: 5, fillOpacity: 0.5, strokeWidth: 0 },
            tooltip: {
              custom: ({
                dataPointIndex,
                seriesIndex,
                w,
              }: {
                dataPointIndex: number;
                seriesIndex: number;
                w: { config: { series: { data: number[][] }[] } };
              }) => {
                const p = w.config.series[seriesIndex].data[dataPointIndex];
                return `<div style="padding:6px 10px;font-size:12px">${p[0]} bookings · ${NZD2.format(p[1])}</div>`;
              },
            },
          }}
          series={[
            { name: "Nights", data: reports.scatter.map((p) => [p.bookings, p.koha]) },
          ]}
        />
      ) : (
        <ChartEmpty message="No booking data to plot" />
      )}
    </ChartCard>
  );
}

function SummaryByLocation({ reports }: { reports: RestaurantReports }) {
  const { rows, grand } = reports.summary;
  return (
    <ChartCard
      title="Summary by Location"
      icon={TableProperties}
      accent="text-emerald-600 dark:text-emerald-400"
      bodyClassName="px-4"
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-right text-xs">Nights</TableHead>
              <TableHead className="text-right text-xs">Total koha</TableHead>
              <TableHead className="text-right text-xs">Avg koha/night</TableHead>
              <TableHead className="text-right text-xs">Customers</TableHead>
              <TableHead className="text-right text-xs">$ / head</TableHead>
              <TableHead className="text-right text-xs">Avg non-paying</TableHead>
              <TableHead className="text-right text-xs">Avg customers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.location}>
                <TableCell className="text-sm font-medium">{r.location}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{num(r.nights)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{money0(r.totalKoha)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{money2(r.avgKohaPerNight)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{num(r.customers)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{money2(r.perHead)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{oneDp(r.aveNonPaying)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{oneDp(r.aveCustomers)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
              <TableCell className="text-sm">Grand total</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{num(grand.nights)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{money0(grand.totalKoha)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{money2(grand.avgKohaPerNight)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{num(grand.customers)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{money2(grand.perHead)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{oneDp(grand.aveNonPaying)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{oneDp(grand.aveCustomers)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}
