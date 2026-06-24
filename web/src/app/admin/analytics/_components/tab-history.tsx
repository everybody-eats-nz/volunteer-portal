"use client";

import { CalendarRange } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RestaurantReports } from "@/lib/restaurant-reports";
import { ChartCard } from "./primitives";
import { money0, num } from "../_lib/chart-theme";

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return `${d.toLocaleDateString("en-NZ", { month: "short" })} '${y.slice(2)}`;
}

export function TabHistory({ reports }: { reports: RestaurantReports }) {
  if (!reports.hasData) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No historical records for this period.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <BreakdownTable
        title="Donations & Customers — By Year"
        periodLabel="Year"
        rows={reports.byYear.map((r) => ({
          period: r.year,
          location: r.location,
          koha: r.koha,
          customers: r.customers,
        }))}
      />
      <BreakdownTable
        title="Donations & Customers — By Month"
        periodLabel="Month"
        rows={reports.byYearMonth.slice(0, 120).map((r) => ({
          period: fmtMonth(r.ym),
          location: r.location,
          koha: r.koha,
          customers: r.customers,
        }))}
      />
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
    <ChartCard
      title={title}
      icon={CalendarRange}
      accent="text-slate-600 dark:text-slate-400"
      bodyClassName="px-4"
    >
      <div className="max-h-[420px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">{periodLabel}</TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-right text-xs">Donations</TableHead>
              <TableHead className="text-right text-xs">Customers</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.period}-${r.location}-${i}`}>
                <TableCell className="whitespace-nowrap text-sm tabular-nums">
                  {r.period}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.location}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {money0(r.koha)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {num(r.customers)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ChartCard>
  );
}
