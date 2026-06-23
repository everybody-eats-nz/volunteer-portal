"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarRange,
  HandCoins,
  UtensilsCrossed,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";
import type { RestaurantReports } from "@/lib/restaurant-reports";
import { chartTokens } from "../_lib/chart-theme";
import { FilterBar, type FilterState } from "./filter-bar";
import { KpiHero } from "./kpi-hero";
import { TabOverview } from "./tab-overview";
import { TabDonations } from "./tab-donations";
import { TabService } from "./tab-service";
import { TabHistory } from "./tab-history";

const MONTHS_LABELS: Record<string, string> = {
  "1": "last month",
  "3": "last 3 months",
  "6": "last 6 months",
  "12": "last 12 months",
  ytd: "year to date",
  all: "all time",
};

interface Props {
  data: RestaurantAnalyticsData;
  reports: RestaurantReports;
  months: string;
  location: string;
  days: string;
  from: string;
  to: string;
  locations: Array<{ value: string; label: string }>;
}

export function AnalyticsDashboard({
  data,
  reports,
  months: appliedMonths,
  location: appliedLocation,
  days: appliedDays,
  from: appliedFrom,
  to: appliedTo,
  locations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);

  // Draft filter state (edited in the toolbar; applied on "Apply").
  const [draft, setDraft] = useState<FilterState>({
    months: appliedMonths,
    location: appliedLocation,
    days: appliedDays,
    from: appliedFrom,
    to: appliedTo,
  });
  const setState = (patch: Partial<FilterState>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const applied: FilterState = {
    months: appliedMonths,
    location: appliedLocation,
    days: appliedDays,
    from: appliedFrom,
    to: appliedTo,
  };

  const hasCustomRange =
    draft.from !== "" && draft.to !== "" && draft.from <= draft.to;
  const rangeError =
    (draft.from !== "" || draft.to !== "") && !hasCustomRange;

  const tokens = useMemo(
    () => chartTokens(resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme]
  );

  const filterKey = `${appliedMonths}-${appliedLocation}-${appliedDays}-${appliedFrom}-${appliedTo}`;
  const rangeLabel =
    appliedMonths === "all"
      ? "all time"
      : appliedFrom && appliedTo
        ? "selected range"
        : MONTHS_LABELS[appliedMonths] ?? "selected period";

  const handleApply = () => {
    if (rangeError) return;
    const params = new URLSearchParams({
      months: draft.months,
      location: draft.location,
    });
    if (draft.days) params.set("days", draft.days);
    if (hasCustomRange) {
      params.set("from", draft.from);
      params.set("to", draft.to);
    }
    startTransition(() => {
      router.push(`/admin/analytics?${params}`, { scroll: false });
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        months: appliedMonths,
        location: appliedLocation,
        format: "csv",
      });
      if (appliedDays) params.set("days", appliedDays);
      if (appliedFrom && appliedTo) {
        params.set("from", appliedFrom);
        params.set("to", appliedTo);
      }
      const res = await fetch(`/api/admin/analytics/service-nights?${params}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const rows = Math.max(0, text.trim().split("\n").length - 1);
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ?? "service-nights.csv";
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${rows.toLocaleString()} service night${rows === 1 ? "" : "s"}`
      );
    } catch (error) {
      console.error("Error exporting service nights:", error);
      toast.error("Couldn't export CSV");
    } finally {
      setExporting(false);
    }
  };

  const isEmpty =
    data.locationBreakdown.length === 0 &&
    !data.currentYearTrend.some((v) => v > 0) &&
    !data.hasServiceStats;

  return (
    <div className="space-y-4 pb-12">
      <FilterBar
        state={draft}
        setState={setState}
        locations={locations}
        hasCustomRange={hasCustomRange}
        rangeError={rangeError}
        isPending={isPending}
        exporting={exporting}
        onApply={handleApply}
        onExport={handleExport}
      />

      <motion.div
        key={filterKey}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`space-y-5 transition-opacity ${
          isPending ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <motion.div variants={staggerItem}>
          <KpiHero data={data} reports={reports} rangeLabel={rangeLabel} />
        </motion.div>

        {isEmpty ? (
          <motion.div variants={staggerItem}>
            <div className="rounded-xl border bg-card py-16 text-center text-muted-foreground">
              <UtensilsCrossed className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <p className="font-medium">No data available</p>
              <p className="mt-1 text-sm">
                No restaurant data found for the {rangeLabel}
                {appliedLocation !== "all" && ` at ${appliedLocation}`}.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div variants={staggerItem}>
            <Tabs defaultValue="overview" className="gap-4">
              <div className="overflow-x-auto">
                <TabsList className="h-10">
                  <TabsTrigger value="overview" className="px-3">
                    <BarChart3 className="h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="donations" className="px-3">
                    <HandCoins className="h-4 w-4" />
                    Koha &amp; Donations
                  </TabsTrigger>
                  <TabsTrigger value="service" className="px-3">
                    <UtensilsCrossed className="h-4 w-4" />
                    Service &amp; Guests
                  </TabsTrigger>
                  <TabsTrigger value="history" className="px-3">
                    <CalendarRange className="h-4 w-4" />
                    History
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview">
                <TabOverview data={data} tokens={tokens} filterKey={filterKey} />
              </TabsContent>
              <TabsContent value="donations">
                <TabDonations reports={reports} tokens={tokens} />
              </TabsContent>
              <TabsContent value="service">
                <TabService
                  data={data}
                  reports={reports}
                  tokens={tokens}
                  filterKey={filterKey}
                  applied={applied}
                />
              </TabsContent>
              <TabsContent value="history">
                <TabHistory reports={reports} />
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
