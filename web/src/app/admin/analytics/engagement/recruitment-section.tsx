"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  UserPlus,
  Clock,
  TrendingUp,
  Users,
  Info,
  UserX,
  CalendarCheck,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  RecruitmentData,
  RecruitmentFunnelBreakdown,
} from "@/lib/recruitment-types";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

// Stable per-location color palette. Well-known locations get fixed colors so
// the stacking stays consistent across pages; anything else cycles through
// `FALLBACK_COLORS`. "Unspecified" is muted so it doesn't dominate.
const LOCATION_COLORS: Record<string, string> = {
  Wellington: "#3b82f6",
  "Glen Innes": "#8b5cf6",
  Onehunga: "#10b981",
  "Special Event Venue": "#f59e0b",
  [UNSPECIFIED_LOCATION]: "#94a3b8",
};

const FALLBACK_COLORS = [
  "#ec4899",
  "#14b8a6",
  "#fb923c",
  "#6366f1",
  "#f43f5e",
  "#22c55e",
];

function colorForLocation(location: string, index: number): string {
  return (
    LOCATION_COLORS[location] ??
    FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  );
}

function pct(num: number, total: number) {
  if (total === 0) return 0;
  return Math.round((num / total) * 100);
}

interface InfoDialogProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function InfoDialog({ title, description, children }: InfoDialogProps) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">More info</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  data: RecruitmentData;
  months: string;
  location: string;
}

type FunnelStageKey =
  | "totalRegistrations"
  | "profileComplete"
  | "signedUp"
  | "completedShift";

function stageValue(
  row: RecruitmentFunnelBreakdown,
  key: FunnelStageKey
): number {
  switch (key) {
    case "totalRegistrations":
      return row.totalRegistrations;
    case "profileComplete":
      return row.totalRegistrations - row.incompleteProfiles;
    case "signedUp":
      return row.signedUpNoShift + row.completedShift;
    case "completedShift":
      return row.completedShift;
  }
}

export function RecruitmentSection({ data, months, location }: Props) {
  const { resolvedTheme } = useTheme();
  const chartMode = (resolvedTheme === "dark" ? "dark" : "light") as
    | "dark"
    | "light";

  const { funnel, registrationTrend, locations } = data;
  const total = funnel.totalRegistrations;
  const periodLabel = MONTHS_LABELS[months] ?? `${months} months`;

  const locationColors = locations.map((loc, i) => colorForLocation(loc, i));

  // Funnel stages — strictly decreasing from total → first shift
  const profileComplete = total - funnel.incompleteProfiles;
  const signedUp = funnel.signedUpNoShift + funnel.completedShift;
  const funnelStages: Array<{
    name: string;
    key: FunnelStageKey;
    value: number;
    desc: string;
  }> = [
    {
      name: "Registered",
      key: "totalRegistrations",
      value: total,
      desc: "Created an account",
    },
    {
      name: "Profile Complete",
      key: "profileComplete",
      value: profileComplete,
      desc: "Finished profile setup",
    },
    {
      name: "Signed Up for a Shift",
      key: "signedUp",
      value: signedUp,
      desc: "At least one shift signup",
    },
    {
      name: "Completed First Shift",
      key: "completedShift",
      value: funnel.completedShift,
      desc: "First confirmed shift done",
    },
  ];

  const hasDistribution = funnel.completedShift > 0;

  const statCards = [
    {
      label: "New Registrations",
      value: String(total),
      sub: `Last ${periodLabel}`,
      icon: UserPlus,
      bg: "bg-blue-50 dark:bg-blue-950/20",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      tooltip:
        "Total new volunteer accounts created during the selected period",
    },
    {
      label: "Profile Incomplete",
      value: String(funnel.incompleteProfiles),
      sub:
        total > 0
          ? `${pct(funnel.incompleteProfiles, total)}% of registrations`
          : "no registrations yet",
      icon: UserX,
      bg: "bg-orange-50 dark:bg-orange-950/20",
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      tooltip:
        "Registered in this period but never completed their profile setup",
    },
    {
      label: "No Shift Signup",
      value: String(funnel.completedProfileNoSignup),
      sub:
        total > 0
          ? `${pct(funnel.completedProfileNoSignup, total)}% completed profile, no shifts`
          : "no registrations yet",
      icon: CalendarCheck,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      tooltip:
        "Completed their profile but haven't signed up for any shifts yet",
    },
    {
      label: "Avg. Days to First Shift",
      value:
        funnel.avgDaysToFirstShift != null
          ? String(funnel.avgDaysToFirstShift)
          : "—",
      sub:
        funnel.avgDaysToFirstShift != null
          ? "registration → first completed shift"
          : "no completed first shifts yet",
      icon: Clock,
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      tooltip:
        "Average number of days between a volunteer registering and completing their very first shift, among those registered in this period",
    },
  ];

  // One ApexCharts series per location so all three bar charts stack by
  // restaurant. `locations` is sorted so colours line up consistently.
  const registrationSeries =
    locations.length > 0
      ? locations.map((loc) => ({
          name: loc,
          data: registrationTrend.map((t) => t.byLocation[loc] ?? 0),
        }))
      : [
          {
            name: "New Registrations",
            data: registrationTrend.map((t) => t.count),
          },
        ];

  const timeToFirstShiftBuckets: Array<
    [
      label: string,
      key: keyof Pick<
        RecruitmentFunnelBreakdown,
        | "sameDay"
        | "within3Days"
        | "within7Days"
        | "within14Days"
        | "within30Days"
        | "within60Days"
        | "within90Days"
        | "over90Days"
      >,
    ]
  > = [
    ["Same day", "sameDay"],
    ["1–3 days", "within3Days"],
    ["4–7 days", "within7Days"],
    ["8–14 days", "within14Days"],
    ["15–30 days", "within30Days"],
    ["31–60 days", "within60Days"],
    ["61–90 days", "within90Days"],
    ["> 90 days", "over90Days"],
  ];

  const timeToFirstShiftSeries = locations.map((loc) => {
    const row = funnel.byLocation.find((b) => b.location === loc);
    return {
      name: loc,
      data: timeToFirstShiftBuckets.map(([, key]) => (row ? row[key] : 0)),
    };
  });

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Stat cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} variants={staggerItem}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={`${card.bg} border-0 cursor-help`}>
                    <CardContent className="flex items-center gap-4 py-5">
                      <div
                        className={`p-2.5 rounded-full shrink-0 ${card.iconBg}`}
                      >
                        <Icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {card.label}
                        </p>
                        <p className="text-2xl font-bold tracking-tight tabular-nums">
                          {card.value}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {card.sub}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-56">
                  {card.tooltip}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registrations over time */}
        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                New Registrations
                <InfoDialog
                  title="New Registrations Over Time"
                  description="Monthly volunteer sign-ups over the past 12 months, stacked by restaurant"
                >
                  <p>
                    Shows how many new volunteer accounts were created each
                    month over the past 12 months, split by the volunteer&rsquo;s
                    primary restaurant (their default location).
                  </p>
                  {location && location !== "all" && (
                    <p>
                      Filtered to volunteers who selected{" "}
                      <strong>{location}</strong> as a preferred location.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Volunteers without a primary restaurant set are grouped as
                    &ldquo;{UNSPECIFIED_LOCATION}&rdquo;. The chart always shows
                    12 months for context — the time period filter above affects
                    the stat cards only.
                  </p>
                </InfoDialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {registrationTrend.some((t) => t.count > 0) ? (
                <Chart
                  options={{
                    chart: {
                      type: "bar" as const,
                      stacked: true,
                      toolbar: { show: false },
                      background: "transparent",
                    },
                    plotOptions: {
                      bar: {
                        borderRadius: 4,
                        borderRadiusApplication: "end" as const,
                        columnWidth: "65%",
                      },
                    },
                    xaxis: {
                      categories: registrationTrend.map((t) => t.month),
                      labels: {
                        style: {
                          fontFamily:
                            "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                        rotate: -45,
                        rotateAlways: false,
                        hideOverlappingLabels: true,
                      },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      min: 0,
                      labels: {
                        style: {
                          fontFamily:
                            "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                        formatter: (v: number) => String(Math.round(v)),
                      },
                    },
                    colors: locationColors.length ? locationColors : ["#3b82f6"],
                    dataLabels: { enabled: false },
                    legend: {
                      show: locations.length > 1,
                      position: "bottom",
                      fontFamily: "var(--font-libre-franklin), sans-serif",
                      fontSize: "12px",
                      markers: { size: 6 },
                      itemMargin: { horizontal: 8, vertical: 4 },
                    },
                    grid: {
                      borderColor: "#e5e7eb",
                      strokeDashArray: 4,
                      xaxis: { lines: { show: false } },
                    },
                    tooltip: {
                      y: {
                        formatter: (val: number) =>
                          `${val} volunteer${val !== 1 ? "s" : ""}`,
                      },
                    },
                    theme: { mode: chartMode },
                  }}
                  series={registrationSeries}
                  type="bar"
                  height={320}
                />
              ) : (
                <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                  No registration data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Onboarding funnel */}
        <motion.div variants={staggerItem}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                Onboarding Funnel
                <InfoDialog
                  title="Onboarding Funnel"
                  description="How new volunteers progress through onboarding, stacked by restaurant"
                >
                  <p>
                    Shows how many volunteers registered in the selected period
                    progressed through each stage of their onboarding journey.
                    Each bar is split by the volunteer&rsquo;s primary
                    restaurant.
                  </p>
                  <div className="space-y-2 pt-1">
                    {funnelStages.map((s) => (
                      <div key={s.name} className="flex gap-2">
                        <span className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 bg-muted-foreground" />
                        <p>
                          <span className="font-medium">{s.name}</span> —{" "}
                          {s.desc}.
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground pt-1">
                    Drop-off numbers show how many people stopped at each
                    stage, helping identify where to focus your onboarding
                    efforts.
                  </p>
                </InfoDialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {total > 0 ? (
                <div className="space-y-4 py-2">
                  {locations.length > 1 && (
                    <div className="flex flex-wrap gap-3 pb-1">
                      {locations.map((loc, i) => (
                        <div
                          key={loc}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ background: locationColors[i] }}
                          />
                          <span className="text-muted-foreground">{loc}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {funnelStages.map((stage, i) => {
                    const stagePct = pct(stage.value, total);
                    const nextStage = funnelStages[i + 1];
                    const dropOff =
                      nextStage != null
                        ? stage.value - nextStage.value
                        : null;
                    const dropOffPct =
                      dropOff != null && stage.value > 0
                        ? pct(dropOff, stage.value)
                        : null;

                    // Segment widths are relative to `total` so all bars share
                    // the same scale, and a location's segment reflects its
                    // share of the whole registered cohort — not just the stage.
                    const segments = locations
                      .map((loc, li) => {
                        const row = funnel.byLocation.find(
                          (b) => b.location === loc
                        );
                        const value = row ? stageValue(row, stage.key) : 0;
                        return {
                          loc,
                          value,
                          color: locationColors[li],
                          widthPct: total > 0 ? (value / total) * 100 : 0,
                        };
                      })
                      .filter((s) => s.value > 0);

                    return (
                      <div key={stage.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">
                              {stage.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted-foreground tabular-nums text-xs">
                              {stage.value.toLocaleString()}
                            </span>
                            <span className="font-semibold tabular-nums w-9 text-right text-sm">
                              {stagePct}%
                            </span>
                          </div>
                        </div>
                        <div className="h-5 bg-muted/30 rounded overflow-hidden flex">
                          {segments.map((seg, si) => (
                            <Tooltip key={seg.loc}>
                              <TooltipTrigger asChild>
                                <motion.div
                                  className="h-full"
                                  style={{ background: seg.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${seg.widthPct}%` }}
                                  transition={{
                                    duration: 0.6,
                                    delay: 0.1 + i * 0.12 + si * 0.04,
                                    ease: [0.4, 0, 0.2, 1],
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <span className="font-medium">{seg.loc}</span>:{" "}
                                {seg.value.toLocaleString()} (
                                {pct(seg.value, stage.value)}% of stage)
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        {dropOff != null && dropOff > 0 && (
                          <p className="text-xs text-muted-foreground pl-4">
                            ↓ {dropOff.toLocaleString()} dropped off
                            {dropOffPct != null ? ` (${dropOffPct}%)` : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  No registrations in this period
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Time-to-first-shift distribution */}
      {hasDistribution && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-500" />
                Time to First Shift Distribution
                <InfoDialog
                  title="Time to First Shift"
                  description="How quickly new volunteers complete their first shift, stacked by restaurant"
                >
                  <p>
                    Among volunteers registered in the selected period who have
                    completed at least one confirmed shift, this shows how many
                    days elapsed between their registration date and their first
                    completed shift. Bars are stacked by the volunteer&rsquo;s
                    primary restaurant.
                  </p>
                  <p>
                    A large proportion in the first bar (≤ 7 days) suggests
                    strong onboarding momentum. A spread toward 90+ days may
                    indicate friction in the signup or scheduling process.
                  </p>
                </InfoDialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                options={{
                  chart: {
                    type: "bar" as const,
                    stacked: true,
                    toolbar: { show: false },
                    background: "transparent",
                  },
                  plotOptions: {
                    bar: {
                      horizontal: true,
                      borderRadius: 4,
                      borderRadiusApplication: "end" as const,
                      barHeight: "55%",
                    },
                  },
                  xaxis: {
                    categories: timeToFirstShiftBuckets.map(([label]) => label),
                    labels: {
                      style: {
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        fontSize: "12px",
                      },
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    title: {
                      text: "Volunteers",
                      style: {
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        fontSize: "11px",
                        fontWeight: 400,
                      },
                    },
                  },
                  yaxis: {
                    labels: {
                      style: {
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        fontSize: "12px",
                      },
                    },
                  },
                  colors: locationColors.length ? locationColors : ["#10b981"],
                  dataLabels: {
                    enabled: true,
                    formatter: (val: number) => (val > 0 ? String(val) : ""),
                    style: {
                      fontFamily: "var(--font-libre-franklin), sans-serif",
                      fontSize: "12px",
                      fontWeight: 600,
                    },
                  },
                  legend: {
                    show: locations.length > 1,
                    position: "bottom",
                    fontFamily: "var(--font-libre-franklin), sans-serif",
                    fontSize: "12px",
                    markers: { size: 6 },
                    itemMargin: { horizontal: 8, vertical: 4 },
                  },
                  grid: {
                    borderColor: "#e5e7eb",
                    strokeDashArray: 4,
                    yaxis: { lines: { show: false } },
                  },
                  tooltip: {
                    y: {
                      formatter: (val: number) =>
                        `${val} volunteer${val !== 1 ? "s" : ""}`,
                    },
                  },
                  theme: { mode: chartMode },
                }}
                series={
                  timeToFirstShiftSeries.length > 0
                    ? timeToFirstShiftSeries
                    : [
                        {
                          name: "Volunteers",
                          data: timeToFirstShiftBuckets.map(
                            ([, key]) => funnel[key]
                          ),
                        },
                      ]
                }
                type="bar"
                height={300}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
