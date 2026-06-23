import type { ApexOptions } from "apexcharts";

/**
 * Shared visual language for every chart on the Restaurant Analytics dashboard.
 * One palette, one set of formatters, one base ApexCharts config — so every
 * card reads as part of the same system regardless of chart type.
 */

export const FONT = "var(--font-jakarta), sans-serif";

/** Semantic colour roles — meaning is tied to colour across the whole page. */
export const PALETTE = {
  guests: "#10b981", // emerald — guests / meals served
  koha: "#f59e0b", // amber — money / koha
  volunteers: "#8b5cf6", // violet — people / volunteers
  bookings: "#14b8a6", // teal — bookings
  cash: "#f59e0b", // amber
  eftpos: "#3b82f6", // blue
  stripe: "#8b5cf6", // violet
  target: "#64748b", // slate — targets / previous year reference
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#64748b",
} as const;

/** Multi-series qualitative palette (e.g. per-location lines). */
export const SERIES_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#0ea5e9",
];

export type ChartMode = "light" | "dark";

export interface ChartTokens {
  mode: ChartMode;
  label: string;
  grid: string;
  axisStyle: { fontFamily: string; fontSize: string; colors: string };
  catStyle: { fontFamily: string; fontSize: string; colors: string };
}

export function chartTokens(mode: ChartMode): ChartTokens {
  const label = mode === "dark" ? "#94a3b8" : "#475569";
  return {
    mode,
    label,
    grid: mode === "dark" ? "#1e293b" : "#eef2f6",
    axisStyle: { fontFamily: FONT, fontSize: "11px", colors: label },
    catStyle: { fontFamily: FONT, fontSize: "12px", colors: label },
  };
}

/**
 * Charts animate by default, but never during e2e runs — the test harness adds
 * an `.e2e-testing` class to <body> (see app/layout.tsx) so Playwright isn't
 * racing transitions. Guarded with `typeof document` so it's safe during SSR.
 */
export function animationsEnabled(): boolean {
  return (
    typeof document !== "undefined" &&
    !document.body?.classList.contains("e2e-testing")
  );
}

/** Common options every chart shares — keeps the system coherent. */
export function baseOptions(t: ChartTokens): ApexOptions {
  const animate = animationsEnabled();
  return {
    chart: {
      toolbar: { show: false },
      background: "transparent",
      fontFamily: FONT,
      animations: {
        enabled: animate,
        speed: 320,
        animateGradually: { enabled: animate, delay: 40 },
      },
      parentHeightOffset: 0,
    },
    dataLabels: { enabled: false },
    grid: {
      borderColor: t.grid,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { top: 0, right: 8, bottom: 0, left: 8 },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      fontFamily: FONT,
      markers: { size: 5, offsetX: -2 },
      itemMargin: { horizontal: 10 },
      labels: { colors: t.label },
    },
    theme: { mode: t.mode },
  };
}

// ── formatters ────────────────────────────────────────────────────────────
const NZD0 = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  maximumFractionDigits: 0,
});
const NZD2 = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const nzd = (n: number, decimals = 0) =>
  (decimals === 2 ? NZD2 : NZD0).format(n);
export const money0 = (n: number | null) => (n === null ? "—" : NZD0.format(n));
export const money2 = (n: number | null) => (n === null ? "—" : NZD2.format(n));
export const oneDp = (n: number | null) => (n === null ? "—" : n.toFixed(1));
export const num = (n: number) => n.toLocaleString("en-NZ");

/** Compact axis tick for counts: 1.2k, 14k … */
export const compactCount = (val: number) =>
  val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val));

/** Compact axis tick for money: $1.2k … */
export const compactMoney = (val: number) =>
  val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`;
