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

// Brand colors (Everybody Eats official theme)
export const BRAND_COLORS = {
  background: "#0e3a23", // Brand green - dark
  backgroundLight: "#1d5337", // Lighter green
  primary: "#256628", // Brand green - lighter
  primaryDark: "#0e3a23", // Brand green - darker
  accent: "#f8fb69", // Brand yellow/accent
  accentLight: "#fcfd94", // Lighter accent
  text: "#fffdf7", // Warm off-white
  textMuted: "rgba(255, 253, 247, 0.7)", // Muted warm off-white
  cardBg: "rgba(255, 253, 247, 0.1)", // Translucent warm white
  cardBorder: "rgba(255, 253, 247, 0.2)", // Translucent warm white
} as const;

// Brand fonts (Everybody Eats official typography)
export const BRAND_FONTS = {
  // Libre Franklin - sans-serif for body text
  sans: '"Libre Franklin", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  // Fraunces - serif with soft/wonk axes for headings/accents
  accent: '"Fraunces", Georgia, serif',
} as const;

// Animation config (matches motion.dev patterns from the app)
export const SPRING_CONFIG = {
  damping: 15,
  stiffness: 200,
  mass: 1,
} as const;
