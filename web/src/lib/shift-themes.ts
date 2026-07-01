// Combined theme structure that works for both admin and public pages
export const SHIFT_THEMES = {
  Kitchen: {
    emoji: "🧽",
    borderColor: "border-blue-300",
    textColor: "text-blue-800", 
    gradient: "from-blue-100 to-cyan-100",
    // Public page specific styles
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    fullGradient: "from-blue-500 to-cyan-500",
  },
  "FOH Set-Up & Service": {
    emoji: "✨",
    borderColor: "border-purple-300",
    textColor: "text-purple-800",
    gradient: "from-purple-100 to-pink-100", 
    // Public page specific styles
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    fullGradient: "from-purple-500 to-pink-500",
  },
  "Dishwasher": {
    emoji: "🧽",
    borderColor: "border-blue-300", 
    textColor: "text-blue-800",
    gradient: "from-blue-100 to-cyan-100",
    // Public page specific styles
    bgColor: "bg-blue-50 dark:bg-blue-950/20", 
    fullGradient: "from-blue-500 to-cyan-500",
  },
  "FOH": {
    emoji: "✨",
    borderColor: "border-purple-300",
    textColor: "text-purple-800", 
    gradient: "from-purple-100 to-pink-100",
    // Public page specific styles
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    fullGradient: "from-purple-500 to-pink-500",
  },
  "Front of House": {
    emoji: "🌟",
    borderColor: "border-green-300",
    textColor: "text-green-800",
    gradient: "from-green-100 to-emerald-100",
    // Public page specific styles
    bgColor: "bg-green-50 dark:bg-green-950/20",
    fullGradient: "from-green-500 to-emerald-500",
  },
  "Kitchen Prep": {
    emoji: "🔪",
    borderColor: "border-orange-300",
    textColor: "text-orange-800",
    gradient: "from-orange-100 to-amber-100",
    // Public page specific styles
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    fullGradient: "from-orange-500 to-amber-500",
  },
  "Kitchen Prep & Service": {
    emoji: "🍳",
    borderColor: "border-red-300",
    textColor: "text-red-800",
    gradient: "from-red-100 to-pink-100",
    // Public page specific styles
    bgColor: "bg-red-50 dark:bg-red-950/20",
    fullGradient: "from-red-500 to-pink-500",
  },
  "Kitchen Service & Pack Down": {
    emoji: "📦",
    borderColor: "border-indigo-300",
    textColor: "text-indigo-800",
    gradient: "from-indigo-100 to-purple-100",
    // Public page specific styles
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
    fullGradient: "from-indigo-500 to-purple-500",
  },
  "Media Role": {
    emoji: "📷",
    borderColor: "border-pink-300",
    textColor: "text-pink-800",
    gradient: "from-pink-100 to-rose-100",
    // Public page specific styles
    bgColor: "bg-pink-50 dark:bg-pink-950/20",
    fullGradient: "from-pink-500 to-rose-500",
  },
  "Cafe Helpers": {
    emoji: "☕",
    borderColor: "border-amber-300",
    textColor: "text-amber-800",
    gradient: "from-amber-100 to-orange-100",
    // Public page specific styles
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    fullGradient: "from-amber-500 to-orange-600",
    // Cover image shown on the shift detail hero + browse card.
    coverImage: "/shift-covers/cafe-helpers.webp",
  },
};

export const DEFAULT_THEME = {
  emoji: "👥",
  borderColor: "border-gray-300",
  textColor: "text-gray-800",
  gradient: "from-gray-100 to-slate-100",
  // Public page specific styles
  bgColor: "bg-gray-50 dark:bg-gray-950/20",
  fullGradient: "from-gray-500 to-slate-500",
};

export interface ShiftTheme {
  emoji: string;
  borderColor: string;
  textColor: string;
  gradient: string;
  // Public page specific styles
  bgColor: string;
  fullGradient: string;
  /**
   * Optional cover image (a path under /public), keyed by shift type. Only some
   * types ship a cover; when absent, surfaces fall back to the gradient accent.
   */
  coverImage?: string;
}

/**
 * Keyword fallback, mirroring the mobile app's shift-type themes
 * (mobile/lib/dummy-data.ts). Shift type names carry location/variant suffixes
 * ("GI", "ONE", "(Onehunga)", "Pop-Up Stand") and hyphenation
 * ("Front-of-House") that the exact lookup above misses, leaving most live
 * shift types on the generic default. First rule whose keyword appears in the
 * normalised name wins, so order matters: most specific role keywords first.
 * Emoji match the mobile set so both apps read as one product.
 *
 * NOTE: Tailwind only generates classes it sees as full literal strings — keep
 * these spelled out, never build class names by interpolation.
 *
 * MAINTENANCE: keywords are matched against live shift-type names from the DB.
 * If those names change (or new types appear), update the keywords here AND in
 * mobile/lib/dummy-data.ts so both stay in sync; otherwise they fall back to
 * the generic default. See shift-themes.test.ts for the expected resolutions.
 */
const KEYWORD_THEMES: { keywords: string[]; theme: ShiftTheme }[] = [
  {
    // Unique keyword — safe near the top; also matches the accented "café".
    keywords: ["cafe", "café", "barista"],
    theme: {
      emoji: "☕",
      borderColor: "border-amber-300",
      textColor: "text-amber-800",
      gradient: "from-amber-100 to-orange-100",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      fullGradient: "from-amber-500 to-orange-600",
      coverImage: "/shift-covers/cafe-helpers.webp",
    },
  },
  {
    keywords: ["dishwash"],
    theme: {
      emoji: "🧽",
      borderColor: "border-blue-300",
      textColor: "text-blue-800",
      gradient: "from-blue-100 to-cyan-100",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      fullGradient: "from-blue-500 to-cyan-500",
    },
  },
  {
    keywords: ["food rescue", "rescue"],
    theme: {
      emoji: "🥕",
      borderColor: "border-lime-300",
      textColor: "text-lime-800",
      gradient: "from-lime-100 to-green-100",
      bgColor: "bg-lime-50 dark:bg-lime-950/20",
      fullGradient: "from-lime-500 to-green-500",
    },
  },
  {
    keywords: ["save a bite"],
    theme: {
      emoji: "🥪",
      borderColor: "border-teal-300",
      textColor: "text-teal-800",
      gradient: "from-teal-100 to-emerald-100",
      bgColor: "bg-teal-50 dark:bg-teal-950/20",
      fullGradient: "from-teal-500 to-emerald-500",
    },
  },
  {
    keywords: ["photograph", "socials", "media"],
    theme: {
      emoji: "📷",
      borderColor: "border-pink-300",
      textColor: "text-pink-800",
      gradient: "from-pink-100 to-rose-100",
      bgColor: "bg-pink-50 dark:bg-pink-950/20",
      fullGradient: "from-pink-500 to-rose-500",
    },
  },
  {
    keywords: ["moving", "packing", "sorting"],
    theme: {
      emoji: "📦",
      borderColor: "border-violet-300",
      textColor: "text-violet-800",
      gradient: "from-violet-100 to-purple-100",
      bgColor: "bg-violet-50 dark:bg-violet-950/20",
      fullGradient: "from-violet-500 to-purple-500",
    },
  },
  {
    keywords: ["offsite"],
    theme: {
      emoji: "🚚",
      borderColor: "border-cyan-300",
      textColor: "text-cyan-800",
      gradient: "from-cyan-100 to-blue-100",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
      fullGradient: "from-cyan-500 to-blue-500",
    },
  },
  {
    // Before "clean" so "Front of House Service & Clean Up" reads as FOH.
    keywords: ["front of house", "foh"],
    theme: {
      emoji: "✨",
      borderColor: "border-purple-300",
      textColor: "text-purple-800",
      gradient: "from-purple-100 to-pink-100",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      fullGradient: "from-purple-500 to-pink-500",
    },
  },
  {
    keywords: ["clean"],
    theme: {
      emoji: "🧹",
      borderColor: "border-blue-300",
      textColor: "text-blue-800",
      gradient: "from-blue-100 to-cyan-100",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      fullGradient: "from-blue-500 to-cyan-500",
    },
  },
  {
    keywords: ["kitchen prep", "prep"],
    theme: {
      emoji: "🔪",
      borderColor: "border-orange-300",
      textColor: "text-orange-800",
      gradient: "from-orange-100 to-amber-100",
      bgColor: "bg-orange-50 dark:bg-orange-950/20",
      fullGradient: "from-orange-500 to-amber-500",
    },
  },
  {
    keywords: ["kitchen"],
    theme: {
      emoji: "🍳",
      borderColor: "border-red-300",
      textColor: "text-red-800",
      gradient: "from-red-100 to-pink-100",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      fullGradient: "from-red-500 to-pink-500",
    },
  },
  {
    // Before "event" so "Event Set-up" reads as a set-up shift.
    keywords: ["set up", "setup"],
    theme: {
      emoji: "🛠️",
      borderColor: "border-amber-300",
      textColor: "text-amber-800",
      gradient: "from-amber-100 to-orange-100",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      fullGradient: "from-amber-500 to-orange-500",
    },
  },
  {
    keywords: ["information", "info session", "session"],
    theme: {
      emoji: "📋",
      borderColor: "border-cyan-300",
      textColor: "text-cyan-800",
      gradient: "from-cyan-100 to-blue-100",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
      fullGradient: "from-cyan-500 to-blue-500",
    },
  },
  {
    keywords: ["event"],
    theme: {
      emoji: "🎉",
      borderColor: "border-purple-300",
      textColor: "text-purple-800",
      gradient: "from-purple-100 to-pink-100",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      fullGradient: "from-purple-500 to-pink-500",
    },
  },
  {
    keywords: ["service", "serving"],
    theme: {
      emoji: "✨",
      borderColor: "border-purple-300",
      textColor: "text-purple-800",
      gradient: "from-purple-100 to-pink-100",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
      fullGradient: "from-purple-500 to-pink-500",
    },
  },
];

/**
 * Resolve the theme for a shift type. Resolution order: exact name match →
 * keyword match (names normalised so hyphen/slash variants still match) →
 * generic default. Always returns a complete theme; never null.
 */
export function getShiftTheme(shiftTypeName: string): ShiftTheme {
  // 1. Exact, hand-curated match wins.
  const exact = SHIFT_THEMES[shiftTypeName as keyof typeof SHIFT_THEMES];
  if (exact) return exact;

  // 2. Keyword match — flatten hyphens/slashes so "Front-of-House" and
  //    "Helper & Prep" still resolve to a role-appropriate theme.
  const normalized = shiftTypeName.toLowerCase().replace(/[-/]/g, " ");
  for (const rule of KEYWORD_THEMES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.theme;
    }
  }

  // 3. Generic fallback.
  return DEFAULT_THEME;
}