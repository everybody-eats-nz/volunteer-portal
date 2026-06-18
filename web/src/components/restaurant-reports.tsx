"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableProperties,
  TrendingUp,
  Users,
  HandCoins,
  UserPlus,
  CalendarRange,
  Scaling,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StackModeToggle, type StackMode } from "@/components/stack-mode-toggle";
import type { RestaurantReports } from "@/lib/restaurant-reports";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const FONT = "var(--font-jakarta), sans-serif";

const NZD0 = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });
const NZD2 = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-NZ");
const money0 = (n: number | null) => (n === null ? "—" : NZD0.format(n));
const money2 = (n: number | null) => (n === null ? "—" : NZD2.format(n));
const oneDp = (n: number | null) => (n === null ? "—" : n.toFixed(1));

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return `${d.toLocaleDateString("en-NZ", { month: "short" })} '${y.slice(2)}`;
}

const METRICS = [
  { key: "koha", label: "Total koha", money: true, color: "#f59e0b", chart: "area" },
  { key: "perHead", label: "$ per head", money: true, color: "#10b981", chart: "line" },
  { key: "customers", label: "Customers", money: false, color: "#3b82f6", chart: "area" },
  { key: "avgCustomers", label: "Avg customers / night", money: false, color: "#0ea5e9", chart: "line" },
  { key: "avgKohaPerNight", label: "Avg koha / night", money: true, color: "#f59e0b", chart: "line" },
  { key: "nights", label: "Record count", money: false, color: "#64748b", chart: "bar" },
  { key: "newVolunteers", label: "New volunteers", money: false, color: "#8b5cf6", chart: "bar" },
  { key: "bookings", label: "Bookings", money: false, color: "#14b8a6", chart: "area" },
] as const;

const LOC_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444"];

export function RestaurantReports({ data }: { data: RestaurantReports }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const themeMode = (dark ? "dark" : "light") as "dark" | "light";
  const labelColor = dark ? "#94a3b8" : "#475569";
  const grid = dark ? "#334155" : "#e5e7eb";
  const axisStyle = { fontFamily: FONT, fontSize: "11px", colors: labelColor };

  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("koha");
  const [gran, setGran] = useState<"monthly" | "yearly">("monthly");
  const [payStack, setPayStack] = useState<StackMode>("stacked");

  if (!data.hasData) return null;

  const m = METRICS.find((x) => x.key === metric)!;
  const labels = gran === "monthly" ? data.monthLabels.map(fmtMonth) : data.yearLabels;
  const series = (gran === "monthly" ? data.monthly : data.yearly)[metric] as (number | null)[];

  const moneyAxis = (val: number) =>
    val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`;
  const countAxis = (val: number) =>
    val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val));

  return (
    <div className="space-y-6">
      {/* ── Per-location summary table ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TableProperties className="h-4 w-4 text-emerald-500" />
            Summary by Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
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
                {data.summary.rows.map((r) => (
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
                <TableRow className="border-t-2 bg-muted/30 font-semibold">
                  <TableCell className="text-sm">Grand total</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{num(data.summary.grand.nights)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{money0(data.summary.grand.totalKoha)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{money2(data.summary.grand.avgKohaPerNight)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{num(data.summary.grand.customers)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{money2(data.summary.grand.perHead)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{oneDp(data.summary.grand.aveNonPaying)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{oneDp(data.summary.grand.aveCustomers)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Metric trends (monthly / yearly) ───────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Trends
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
                <SelectTrigger className="h-8 w-[200px]">
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
              <div className="flex items-center rounded-md border text-sm">
                {(["monthly", "yearly"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGran(g)}
                    className={cn(
                      "px-3 py-1 capitalize transition-colors first:rounded-l-md last:rounded-r-md",
                      gran === g ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Chart
            key={`trend-${metric}-${gran}-${labels.length}`}
            type={m.chart}
            height={320}
            options={{
              chart: { type: m.chart, toolbar: { show: false }, background: "transparent" },
              colors: [m.color],
              xaxis: {
                categories: labels,
                tickAmount: gran === "monthly" ? Math.min(12, labels.length) : undefined,
                labels: { style: axisStyle, rotate: 0 },
                axisBorder: { show: false },
                axisTicks: { show: false },
              },
              yaxis: { labels: { formatter: m.money ? moneyAxis : countAxis, style: axisStyle }, min: 0 },
              stroke: { curve: "smooth", width: m.chart === "bar" ? 0 : 2.5 },
              fill: m.chart === "area"
                ? { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] } }
                : { opacity: 1 },
              plotOptions: { bar: { borderRadius: 3, columnWidth: "60%" } },
              dataLabels: { enabled: false },
              grid: { borderColor: grid, strokeDashArray: 4, xaxis: { lines: { show: false } } },
              markers: { size: 0, hover: { sizeOffset: 3 } },
              tooltip: { y: { formatter: (v: number) => (v == null ? "—" : m.money ? NZD2.format(v) : num(Math.round(v))) } },
              theme: { mode: themeMode },
            }}
            series={[{ name: m.label, data: series.map((v) => (v === null ? 0 : v)) }]}
          />
        </CardContent>
      </Card>

      {/* ── Paying vs non-paying + Customers vs bookings ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          icon={Users}
          accent="text-rose-500"
          title="Paying vs non-paying"
          action={<StackModeToggle value={payStack} onChange={setPayStack} />}
        >
          <Chart
            key={`pay-${data.monthLabels.length}-${payStack}`}
            type="bar"
            height={300}
            options={{
              chart: {
                type: "bar",
                stacked: true,
                stackType: payStack === "100%" ? "100%" : "normal",
                toolbar: { show: false },
                background: "transparent",
              },
              colors: ["#10b981", "#f43f5e"],
              xaxis: { categories: data.monthLabels.map(fmtMonth), tickAmount: 12, labels: { style: axisStyle }, axisBorder: { show: false }, axisTicks: { show: false } },
              yaxis: {
                labels: {
                  formatter: payStack === "100%" ? (v: number) => `${Math.round(v)}%` : countAxis,
                  style: axisStyle,
                },
                max: payStack === "100%" ? 100 : undefined,
              },
              plotOptions: { bar: { columnWidth: "70%" } },
              dataLabels: { enabled: false },
              legend: { position: "top", fontSize: "12px", fontFamily: FONT, markers: { size: 6 } },
              grid: { borderColor: grid, strokeDashArray: 4, xaxis: { lines: { show: false } } },
              tooltip: { shared: true, intersect: false, y: { formatter: (v: number) => num(Math.round(v ?? 0)) } },
              theme: { mode: themeMode },
            }}
            series={[
              { name: "Paying", data: data.monthly.paying },
              { name: "Non-paying", data: data.monthly.nonPaying },
            ]}
          />
        </ChartCard>

        <ChartCard icon={CalendarRange} accent="text-sky-500" title="Customers vs bookings">
          <Chart
            key={`cb-${data.monthLabels.length}`}
            type="line"
            height={300}
            options={{
              chart: { type: "line", toolbar: { show: false }, background: "transparent" },
              colors: ["#3b82f6", "#14b8a6"],
              xaxis: { categories: data.monthLabels.map(fmtMonth), tickAmount: 12, labels: { style: axisStyle }, axisBorder: { show: false }, axisTicks: { show: false } },
              yaxis: [
                { seriesName: "Customers", labels: { formatter: countAxis, style: axisStyle }, title: { text: "Customers", style: { fontFamily: FONT, fontSize: "11px", color: labelColor } } },
                { seriesName: "Bookings", opposite: true, labels: { formatter: countAxis, style: axisStyle }, title: { text: "Bookings", style: { fontFamily: FONT, fontSize: "11px", color: labelColor } } },
              ],
              stroke: { curve: "smooth", width: 2.5 },
              dataLabels: { enabled: false },
              legend: { position: "top", fontSize: "12px", fontFamily: FONT, markers: { size: 6 } },
              grid: { borderColor: grid, strokeDashArray: 4, xaxis: { lines: { show: false } } },
              markers: { size: 0 },
              theme: { mode: themeMode },
            }}
            series={[
              { name: "Customers", data: data.monthly.customers },
              { name: "Bookings", data: data.monthly.bookings },
            ]}
          />
        </ChartCard>
      </div>

      {/* ── New volunteers by location + $/head by weekday ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard icon={UserPlus} accent="text-violet-500" title="New volunteers by location">
          {data.newVolByLocation.series.length > 0 ? (
            <Chart
              key={`nv-${data.monthLabels.length}`}
              type="line"
              height={300}
              options={{
                chart: { type: "line", toolbar: { show: false }, background: "transparent" },
                colors: LOC_COLORS,
                xaxis: { categories: data.monthLabels.map(fmtMonth), tickAmount: 12, labels: { style: axisStyle }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { formatter: countAxis, style: axisStyle }, min: 0 },
                stroke: { curve: "smooth", width: 2 },
                dataLabels: { enabled: false },
                legend: { position: "top", fontSize: "12px", fontFamily: FONT, markers: { size: 6 } },
                grid: { borderColor: grid, strokeDashArray: 4, xaxis: { lines: { show: false } } },
                markers: { size: 0 },
                theme: { mode: themeMode },
              }}
              series={data.newVolByLocation.series.map((s) => ({ name: s.location, data: s.data }))}
            />
          ) : (
            <ReportEmpty msg="No new-volunteer data" />
          )}
        </ChartCard>

        <ChartCard icon={Scaling} accent="text-amber-500" title="$ per head by day of week">
          <Chart
            key={`wd-${data.monthLabels.length}`}
            type="bar"
            height={300}
            options={{
              chart: { type: "bar", toolbar: { show: false }, background: "transparent" },
              colors: ["#f59e0b"],
              plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: "end", barHeight: "62%" } },
              xaxis: { categories: data.weekday.map((w) => w.day), labels: { formatter: (v: string) => `$${Number(v).toFixed(1)}`, style: axisStyle } },
              yaxis: { labels: { style: { fontFamily: FONT, fontSize: "12px", colors: labelColor } } },
              dataLabels: { enabled: true, formatter: (v: number) => (v ? NZD2.format(v) : ""), style: { fontFamily: FONT, fontSize: "11px", fontWeight: 600 } },
              grid: { borderColor: grid, strokeDashArray: 4, yaxis: { lines: { show: false } } },
              tooltip: { y: { formatter: (v: number) => money2(v ?? 0) } },
              theme: { mode: themeMode },
            }}
            series={[{ name: "$ / head", data: data.weekday.map((w) => w.perHead ?? 0) }]}
          />
        </ChartCard>
      </div>

      {/* ── Bookings → donations scatter ───────────────────────── */}
      {data.scatter.length > 0 && (
        <ChartCard icon={HandCoins} accent="text-amber-500" title="Bookings → donations">
          <Chart
            key={`scatter-${data.scatter.length}`}
            type="scatter"
            height={320}
            options={{
              chart: { type: "scatter", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent" },
              colors: ["#3b82f6"],
              xaxis: { type: "numeric", tickAmount: 10, title: { text: "Bookings", style: { fontFamily: FONT, fontSize: "11px", color: labelColor } }, labels: { style: axisStyle } },
              yaxis: { labels: { formatter: moneyAxis, style: axisStyle }, title: { text: "Total koha", style: { fontFamily: FONT, fontSize: "11px", color: labelColor } } },
              grid: { borderColor: grid, strokeDashArray: 4 },
              markers: { size: 4, fillOpacity: 0.5 },
              tooltip: { custom: ({ dataPointIndex, seriesIndex, w }: { dataPointIndex: number; seriesIndex: number; w: { config: { series: { data: number[][] }[] } } }) => {
                const p = w.config.series[seriesIndex].data[dataPointIndex];
                return `<div style="padding:6px 10px;font-size:12px">${p[0]} bookings · ${NZD2.format(p[1])}</div>`;
              } },
              theme: { mode: themeMode },
            }}
            series={[{ name: "Nights", data: data.scatter.map((p) => [p.bookings, p.koha]) }]}
          />
        </ChartCard>
      )}

      {/* ── Year & Year-Month tables ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownTable
          title="By Year"
          periodLabel="Year"
          rows={data.byYear.map((r) => ({ period: r.year, location: r.location, koha: r.koha, customers: r.customers }))}
        />
        <BreakdownTable
          title="By Month"
          periodLabel="Month"
          rows={data.byYearMonth.slice(0, 120).map((r) => ({ period: fmtMonth(r.ym), location: r.location, koha: r.koha, customers: r.customers }))}
        />
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────

function ChartCard({
  icon: Icon,
  accent,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Icon className={cn("h-4 w-4", accent)} />
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReportEmpty({ msg }: { msg: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

function BreakdownTable({
  title,
  periodLabel,
  rows,
}: {
  title: string;
  periodLabel: string;
  rows: Array<{ period: string; location: string; koha: number; customers: number }>;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarRange className="h-4 w-4 text-slate-500" />
          Donations &amp; Customers — {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[360px] overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="text-xs">{periodLabel}</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-right text-xs">Donations</TableHead>
                <TableHead className="text-right text-xs">Customers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.period}-${r.location}-${i}`}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">{r.period}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{r.location}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{money0(r.koha)}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{num(r.customers)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
