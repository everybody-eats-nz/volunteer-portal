import type { ApexOptions } from "apexcharts";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";

/**
 * Shared visual language for every admin analytics chart. One palette, one set
 * of formatters, one base ApexCharts config, so every card reads as part of the
 * same system regardless of page or chart type.
 *
 * Colours are selected per mode (light and dark are each validated against
 * their own card surface), so always read them from `chartTokens(mode)` rather
 * than hard-coding hex values in a chart.
 */

export const FONT = "var(--font-jakarta), sans-serif";

export type ChartMode = "light" | "dark";

// ── categorical palette ───────────────────────────────────────────────────
// Built from the Everybody Eats brand: forest green and sun lead, followed by
// warm and cool partners. The order is fixed and is the colour-blind safety
// mechanism (adjacent series stay distinguishable under protanopia and
// deuteranopia, the first four slots are distinguishable all-pairs), so
// series take slots in order and never cycle. Every slot clears 3:1 against
// its mode's card surface. Validated with the dataviz palette checker
// (lightness band, chroma floor, CVD ΔE ≥ 8, normal-vision ΔE ≥ 15, contrast).
const SERIES = {
  light: [
    "#206b38", // forest
    "#a68e27", // sun (deepened to ochre so it holds 3:1 on white)
    "#b54076", // rose
    "#1480d7", // blue
    "#c95427", // clay
    "#6a3ea5", // violet
    "#179696", // teal
  ],
  dark: [
    "#3e8250", // forest
    "#aa9122", // sun
    "#d96597", // rose
    "#2687db", // blue
    "#d25829", // clay
    "#9a6ddd", // violet
    "#06999a", // teal
  ],
} as const;

const Slot = {
  Forest: 0,
  Sun: 1,
  Rose: 2,
  Blue: 3,
  Clay: 4,
  Violet: 5,
  Teal: 6,
} as const;
type Slot = (typeof Slot)[keyof typeof Slot];

// Ordinal ramps (light → dark on a light surface, flipped on dark so the
// strongest step is always the most prominent). Forest is the brand hue; each
// step is ≥ 0.06 OKLCH L from its neighbour and the faintest still clears 2:1.
const FOREST_RAMP = {
  light: ["#9bbda0", "#78a47f", "#5a8b62", "#2e6438", "#163f2a", "#0e2a1c"],
  dark: ["#2e6438", "#3f7a4b", "#56925f", "#74ad7d", "#97c79e", "#bfe0c3"],
} as const;

// Sequential heatmap bins, faint → strong. On dark the faint end sits near the
// surface, so magnitude still reads as "more colour = more". The faint step
// stays clearly apart from the neutral "0% / no data" cell in both modes.
const FOREST_SEQUENTIAL = {
  light: ["#d4e3d6", "#9bbda0", "#5a8b62", "#2e6438", "#163f2a"],
  dark: ["#244a31", "#356e44", "#4f8a5b", "#74ad7d", "#a9d9b2"],
} as const;

interface ModeNeutrals {
  surface: string;
  label: string;
  foreground: string;
  grid: string;
  neutral: string;
  empty: string;
  positiveText: string;
  negativeText: string;
}

const NEUTRALS: Record<ChartMode, ModeNeutrals> = {
  light: {
    surface: "#ffffff",
    label: "#57534e",
    foreground: "#14181c",
    grid: "#ece8e1",
    neutral: "#78716c",
    empty: "#f1eee8",
    positiveText: "#15803d",
    negativeText: "#b91c1c",
  },
  dark: {
    surface: "#0a0b0c",
    label: "#a8a29e",
    foreground: "#e5f0e8",
    grid: "#24262a",
    neutral: "#8a847e",
    empty: "#1a1c1f",
    positiveText: "#4ade80",
    negativeText: "#f87171",
  },
};

/**
 * Status scale, reserved for meaning (good → critical) and never used as a
 * series colour. Always shipped with a label so it never relies on colour.
 * Good and critical are split by lightness as well as hue, so they stay apart
 * under red/green colour blindness (all-pairs CVD ΔE ≥ 8 in both modes).
 * Warning sits below 3:1 on white by design: every status chart labels its
 * segments in the legend, tooltip and an accompanying table.
 */
const STATUS = {
  light: { good: "#206b38", warning: "#e9a21a", critical: "#f06a5e" },
  dark: { good: "#6cc58a", warning: "#e9a21a", critical: "#c43c3c" },
} as const;

export interface ChartTokens {
  mode: ChartMode;
  /** Axis and legend ink. */
  label: string;
  /** Primary ink for values drawn on the chart. */
  foreground: string;
  /** The card surface the chart sits on (used for 2px gaps between marks). */
  surface: string;
  grid: string;
  axisStyle: { fontFamily: string; fontSize: string; colors: string };
  catStyle: { fontFamily: string; fontSize: string; colors: string };
  /** Categorical palette in its fixed order. Never cycle past its length. */
  series: readonly string[];
  /** Semantic roles: meaning is tied to colour across every analytics page. */
  palette: {
    guests: string;
    koha: string;
    volunteers: string;
    bookings: string;
    customers: string;
    cash: string;
    eftpos: string;
    stripe: string;
    /** Targets, previous-year references and "other" buckets. */
    target: string;
    neutral: string;
    positive: string;
    negative: string;
  };
  status: { good: string; warning: string; critical: string };
  /** Text-safe (≥ 4.5:1) ink for up / down deltas in tooltips. */
  deltaText: { positive: string; negative: string; neutral: string };
  /** Fill for "no value" cells (heatmap N/A, empty tracks). */
  empty: string;
}

export function chartTokens(mode: ChartMode): ChartTokens {
  const n = NEUTRALS[mode];
  const s = SERIES[mode];
  return {
    mode,
    label: n.label,
    foreground: n.foreground,
    surface: n.surface,
    grid: n.grid,
    axisStyle: { fontFamily: FONT, fontSize: "12px", colors: n.label },
    catStyle: { fontFamily: FONT, fontSize: "12px", colors: n.label },
    series: s,
    palette: {
      guests: s[Slot.Forest],
      koha: s[Slot.Sun],
      volunteers: s[Slot.Violet],
      bookings: s[Slot.Teal],
      customers: s[Slot.Blue],
      cash: s[Slot.Sun],
      eftpos: s[Slot.Blue],
      stripe: s[Slot.Violet],
      target: n.neutral,
      neutral: n.neutral,
      positive: STATUS[mode].good,
      negative: STATUS[mode].critical,
    },
    status: STATUS[mode],
    deltaText: {
      positive: n.positiveText,
      negative: n.negativeText,
      neutral: n.label,
    },
    empty: n.empty,
  };
}

/** Resolve the current chart mode from next-themes' `resolvedTheme`. */
export function chartModeFrom(resolvedTheme: string | undefined): ChartMode {
  return resolvedTheme === "dark" ? "dark" : "light";
}

// ── locations ─────────────────────────────────────────────────────────────
// Each restaurant owns one slot on every page, so "Wellington" is the same
// colour on the dashboard, milestones, recruitment and shortage charts. The
// first four slots are the ones validated all-pairs, so the real restaurants
// sit there. "Unspecified" (no primary restaurant) is neutral on purpose so it
// never competes with a real place.
const LOCATION_SLOTS: Record<string, Slot> = {
  Wellington: Slot.Forest,
  "Glen Innes": Slot.Sun,
  Onehunga: Slot.Rose,
  "Special Event Venue": Slot.Blue,
};

const SPARE_SLOTS = [Slot.Clay, Slot.Violet, Slot.Teal];

/**
 * The colour for a restaurant. Stable by name, never by row position, so a
 * filter that drops a location doesn't repaint the others. Unknown locations
 * hash onto the spare slots.
 */
export function colorForLocation(name: string, t: ChartTokens): string {
  if (name === UNSPECIFIED_LOCATION) return t.palette.neutral;
  const known = LOCATION_SLOTS[name];
  if (known !== undefined) return t.series[known];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return t.series[SPARE_SLOTS[hash % SPARE_SLOTS.length]];
}

// ── ordered scales ────────────────────────────────────────────────────────

/**
 * `count` steps of the forest ramp for ordered categories (activity level,
 * milestone tier), weakest first. Weak steps sit nearest the surface in both
 * modes, so the strongest category always reads as the most prominent.
 */
export function ordinalScale(count: number, t: ChartTokens): string[] {
  const ramp = FOREST_RAMP[t.mode];
  if (count <= 1) return [ramp[ramp.length - 2]];
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round((i * (ramp.length - 1)) / (count - 1));
    return ramp[idx];
  });
}

/** Five forest bins for magnitude (heatmaps), faint → strong. */
export function sequentialBins(t: ChartTokens): readonly string[] {
  return FOREST_SEQUENTIAL[t.mode];
}

// ── base options ──────────────────────────────────────────────────────────

/**
 * Charts animate by default, but never during e2e runs — the test harness adds
 * an `.e2e-testing` class to <body> (see app/layout.tsx) so Playwright isn't
 * racing transitions. Guarded with `typeof document` so it's safe during SSR.
 * Reduced-motion users also get static charts.
 */
export function animationsEnabled(): boolean {
  if (typeof document === "undefined") return false;
  if (document.body?.classList.contains("e2e-testing")) return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Common options every chart shares — keeps the system coherent. */
export function baseOptions(t: ChartTokens): ApexOptions {
  const animate = animationsEnabled();
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      fontFamily: FONT,
      foreColor: t.label,
      animations: {
        enabled: animate,
        speed: 320,
        animateGradually: { enabled: animate, delay: 40 },
      },
      parentHeightOffset: 0,
    },
    colors: [...t.series],
    dataLabels: { enabled: false },
    grid: {
      borderColor: t.grid,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      padding: { top: 0, right: 8, bottom: 0, left: 8 },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
      fontSize: "12px",
      fontFamily: FONT,
      markers: { size: 5, offsetX: -2 },
      itemMargin: { horizontal: 10, vertical: 2 },
      labels: { colors: t.label },
    },
    states: {
      active: { filter: { type: "none" } },
    },
    tooltip: { theme: t.mode, style: { fontFamily: FONT, fontSize: "12px" } },
    theme: { mode: t.mode },
  };
}

/**
 * Bar and column charts: a 2px surface-coloured gap between adjacent fills
 * (stacked segments and neighbouring bars) instead of outlines.
 */
export function barGap(t: ChartTokens): ApexOptions["stroke"] {
  return { show: true, width: 2, colors: [t.surface] };
}

const INK_DARK = "#14181c";
const INK_LIGHT = "#ffffff";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whichever of near-black or white reads better on a `#rrggbb` fill. */
export function readableInk(fill: string): string {
  const l = luminance(fill);
  const onDark = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  const onLight = (1 + 0.05) / (l + 0.05);
  return onDark >= onLight ? INK_DARK : INK_LIGHT;
}

/** Value labels drawn inside fills: one readable ink per fill. */
export function insideLabelStyle(fills: readonly string[]) {
  return {
    fontFamily: FONT,
    fontSize: "12px",
    fontWeight: 600,
    colors: fills.map(readableInk),
  };
}

/**
 * Formatter for value labels inside stacked bars: hides labels on segments too
 * small to hold them (under `minShare` of the largest stack) rather than
 * letting them spill over the edge.
 */
export function segmentLabel(stackTotals: number[], minShare = 0.08) {
  const largest = Math.max(0, ...stackTotals);
  return (val: number) =>
    val > 0 && val >= largest * minShare ? count(val) : "";
}

/** Tooltip markup for a "+n vs …" delta, coloured with text-safe ink. */
export function deltaHtml(
  diff: number,
  suffix: string,
  t: ChartTokens,
  format: (n: number) => string = num
): string {
  if (diff > 0) {
    return `<span style="color:${t.deltaText.positive}">+${format(diff)} ${suffix}</span>`;
  }
  if (diff < 0) {
    return `<span style="color:${t.deltaText.negative}">${format(diff)} ${suffix}</span>`;
  }
  return `<span style="color:${t.deltaText.neutral}">No change</span>`;
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
const COUNT = new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 0 });

export const nzd = (n: number, decimals = 0) =>
  (decimals === 2 ? NZD2 : NZD0).format(n);
export const money0 = (n: number | null) => (n === null ? "—" : NZD0.format(n));
export const money2 = (n: number | null) => (n === null ? "—" : NZD2.format(n));
export const oneDp = (n: number | null) => (n === null ? "—" : n.toFixed(1));
export const num = (n: number) => n.toLocaleString("en-NZ");

/** Whole-number count for axes and tooltips (en-NZ grouping). */
export const count = (n: number) => COUNT.format(Math.round(n ?? 0));

/** "1 volunteer" / "1,204 volunteers". */
export const plural = (n: number, noun: string, nouns = `${noun}s`) =>
  `${count(n)} ${Math.round(n) === 1 ? noun : nouns}`;

/** Compact axis tick for counts: 1.2k, 14k … */
export const compactCount = (val: number) =>
  val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val));

/** Compact axis tick for money: $1.2k … */
export const compactMoney = (val: number) =>
  val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`;
