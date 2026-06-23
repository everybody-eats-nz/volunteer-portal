// Shared colour intelligence for the custom-labels admin experience.
//
// Labels persist their colour as a full Tailwind class string (e.g.
// "bg-purple-50 text-purple-700 border-purple-200 ..."). To theme the
// redesigned cards, swatches and member modal we derive a single colour
// "family" from that string and map it to a richer set of tokens (solid
// swatch, soft surface, ring, accent text, usage bar).

export type ColorFamily =
  | "purple"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo"
  | "teal"
  | "orange"
  | "slate";

export interface FamilyTheme {
  /** Solid swatch dot, e.g. on the picker + card colour chip */
  dot: string;
  /** Soft tinted surface for card headers / icon wells */
  soft: string;
  /** Ring/border tint that pairs with the soft surface */
  ring: string;
  /** Accent text colour */
  text: string;
  /** Solid fill for the usage progress bar */
  bar: string;
  /** Subtle gradient wash for the card spine */
  glow: string;
}

export const FAMILY_THEME: Record<ColorFamily, FamilyTheme> = {
  purple: {
    dot: "bg-purple-500",
    soft: "bg-purple-50 dark:bg-purple-950/30",
    ring: "ring-purple-200/70 dark:ring-purple-900/50",
    text: "text-purple-700 dark:text-purple-300",
    bar: "bg-purple-500",
    glow: "from-purple-400/25",
  },
  blue: {
    dot: "bg-blue-500",
    soft: "bg-blue-50 dark:bg-blue-950/30",
    ring: "ring-blue-200/70 dark:ring-blue-900/50",
    text: "text-blue-700 dark:text-blue-300",
    bar: "bg-blue-500",
    glow: "from-blue-400/25",
  },
  emerald: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-950/30",
    ring: "ring-emerald-200/70 dark:ring-emerald-900/50",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    glow: "from-emerald-400/25",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-50 dark:bg-amber-950/30",
    ring: "ring-amber-200/70 dark:ring-amber-900/50",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    glow: "from-amber-400/25",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-50 dark:bg-rose-950/30",
    ring: "ring-rose-200/70 dark:ring-rose-900/50",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    glow: "from-rose-400/25",
  },
  indigo: {
    dot: "bg-indigo-500",
    soft: "bg-indigo-50 dark:bg-indigo-950/30",
    ring: "ring-indigo-200/70 dark:ring-indigo-900/50",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500",
    glow: "from-indigo-400/25",
  },
  teal: {
    dot: "bg-teal-500",
    soft: "bg-teal-50 dark:bg-teal-950/30",
    ring: "ring-teal-200/70 dark:ring-teal-900/50",
    text: "text-teal-700 dark:text-teal-300",
    bar: "bg-teal-500",
    glow: "from-teal-400/25",
  },
  orange: {
    dot: "bg-orange-500",
    soft: "bg-orange-50 dark:bg-orange-950/30",
    ring: "ring-orange-200/70 dark:ring-orange-900/50",
    text: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500",
    glow: "from-orange-400/25",
  },
  slate: {
    dot: "bg-slate-400",
    soft: "bg-slate-50 dark:bg-slate-900/40",
    ring: "ring-slate-200/70 dark:ring-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    bar: "bg-slate-400",
    glow: "from-slate-400/20",
  },
};

const KNOWN_FAMILIES = Object.keys(FAMILY_THEME) as ColorFamily[];

/**
 * Extract the colour family from a stored Tailwind colour string.
 * The `text-{family}-{shade}` token is the most reliable signal.
 */
export function getColorFamily(color: string | null | undefined): ColorFamily {
  if (!color) return "slate";
  const textMatch = color.match(/text-([a-z]+)-\d/);
  const candidate = textMatch?.[1];
  if (candidate && (KNOWN_FAMILIES as string[]).includes(candidate)) {
    return candidate as ColorFamily;
  }
  // Fall back to any recognised family appearing anywhere in the string.
  const found = KNOWN_FAMILIES.find((f) => color.includes(`-${f}-`));
  return found ?? "slate";
}

export function getLabelTheme(color: string | null | undefined): FamilyTheme {
  return FAMILY_THEME[getColorFamily(color)];
}

export interface ColorOption {
  name: string;
  family: ColorFamily;
  /** Full Tailwind badge class string persisted to the database. */
  value: string;
}

// The eight palette options offered when creating/editing a label. The
// `value` strings remain byte-compatible with previously stored labels.
export const COLOR_OPTIONS: ColorOption[] = [
  {
    name: "Purple",
    family: "purple",
    value:
      "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30",
  },
  {
    name: "Blue",
    family: "blue",
    value:
      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
  },
  {
    name: "Green",
    family: "emerald",
    value:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30",
  },
  {
    name: "Amber",
    family: "amber",
    value:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30",
  },
  {
    name: "Pink",
    family: "rose",
    value:
      "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/30",
  },
  {
    name: "Indigo",
    family: "indigo",
    value:
      "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/30",
  },
  {
    name: "Teal",
    family: "teal",
    value:
      "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-950/30",
  },
  {
    name: "Orange",
    family: "orange",
    value:
      "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30",
  },
];

// Emoji glyphs offered in the icon picker.
export const ICON_OPTIONS = [
  "⭐",
  "🔥",
  "💎",
  "🏆",
  "🎯",
  "⚡",
  "🌟",
  "🎖️",
  "👑",
  "🔔",
  "📌",
  "🚀",
  "✨",
  "💝",
  "🎪",
  "🌈",
];
