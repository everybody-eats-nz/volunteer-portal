// Re-export YearStats type from stats-calculator for use in Remotion compositions
export type { YearStats } from "@/lib/year-in-review/stats-calculator";

// Slide timing configuration (in frames at 30fps)
export const SLIDE_TIMING = {
  intro: 90,         // 3 seconds
  stats: 120,        // 4 seconds
  impact: 120,       // 4 seconds
  achievements: 150, // 5 seconds
  streak: 90,        // 3 seconds
  friends: 90,       // 3 seconds
  highlights: 150,   // 5 seconds
  outro: 90,         // 3 seconds
  // Total: 900 frames = 30 seconds
} as const;

// Transition duration
export const TRANSITION_FRAMES = 15; // 0.5 seconds

// Calculate start frame for each slide
export const SLIDE_START_FRAMES = {
  intro: 0,
  stats: SLIDE_TIMING.intro,
  impact: SLIDE_TIMING.intro + SLIDE_TIMING.stats,
  achievements: SLIDE_TIMING.intro + SLIDE_TIMING.stats + SLIDE_TIMING.impact,
  streak: SLIDE_TIMING.intro + SLIDE_TIMING.stats + SLIDE_TIMING.impact + SLIDE_TIMING.achievements,
  friends: SLIDE_TIMING.intro + SLIDE_TIMING.stats + SLIDE_TIMING.impact + SLIDE_TIMING.achievements + SLIDE_TIMING.streak,
  highlights: SLIDE_TIMING.intro + SLIDE_TIMING.stats + SLIDE_TIMING.impact + SLIDE_TIMING.achievements + SLIDE_TIMING.streak + SLIDE_TIMING.friends,
  outro: SLIDE_TIMING.intro + SLIDE_TIMING.stats + SLIDE_TIMING.impact + SLIDE_TIMING.achievements + SLIDE_TIMING.streak + SLIDE_TIMING.friends + SLIDE_TIMING.highlights,
} as const;

// Brand colors (Everybody Eats theme)
export const BRAND_COLORS = {
  background: "#1a1a1a",
  backgroundLight: "#2a2a2a",
  primary: "#10b981", // green-500
  primaryLight: "#34d399", // green-400
  accent: "#f59e0b", // amber-500
  text: "#ffffff",
  textMuted: "rgba(255, 255, 255, 0.7)",
  cardBg: "rgba(255, 255, 255, 0.1)",
  cardBorder: "rgba(255, 255, 255, 0.2)",
} as const;

// Animation config (matches motion.dev patterns from the app)
export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 200,
  mass: 1,
} as const;
