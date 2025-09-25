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

export function getShiftTheme(shiftTypeName: string) {
  return SHIFT_THEMES[shiftTypeName as keyof typeof SHIFT_THEMES] || DEFAULT_THEME;
}