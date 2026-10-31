import { loadFont as loadLocalFont } from "@remotion/fonts";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { staticFile } from "remotion";
import type { SceneId } from "./timeline";

/**
 * Everybody Eats brand palette, as the marketing site (everybodyeats.nz)
 * uses it: cream pages, deep forest sections, a soft sun accent and peach.
 */
export const colors = {
  cream: "#fdf8ef",
  paper: "#ffffff",
  peach: "#f4d2be",
  forest200: "#9bbda0",
  forest500: "#1d5337",
  forest700: "#0e2a1c",
  sun: "#f8fb69",
  ink: "#1a1410",
} as const;

/** Each scene's colour field and the text colour on it. */
export const sceneColors: Record<
  SceneId,
  { readonly background: string; readonly color: string }
> = {
  // Dark, so the white plate the year is served on is the whole picture.
  intro: { background: colors.forest700, color: colors.cream },
  shifts: { background: colors.sun, color: colors.forest700 },
  meals: { background: colors.cream, color: colors.forest700 },
  rhythm: { background: colors.forest500, color: colors.cream },
  roles: { background: colors.peach, color: colors.forest700 },
  crew: { background: colors.forest700, color: colors.cream },
  achievements: { background: colors.cream, color: colors.forest700 },
  topPercent: { background: colors.sun, color: colors.forest700 },
  together: { background: colors.forest500, color: colors.cream },
  docket: { background: colors.cream, color: colors.forest700 },
  outro: { background: colors.forest700, color: colors.cream },
};

// Fraunces as the marketing site sets it: light, high-contrast display cuts
// with italic phrases. Instanced from the variable fonts in public/fonts at
// the largest optical size (the video never sets Fraunces small) and
// weights 200-600, then subset to Latin with macrons:
// `fonttools varLib.instancer ... opsz=144 SOFT=0 WONK=1 wght=200:600`
// and `fonttools subset ... --flavor=woff2`. About 40 KB each, against
// 350 KB for each full variable font.
loadLocalFont({
  family: "Fraunces Light",
  url: staticFile("fonts/Fraunces-Light.woff2"),
  weight: "200 600",
  style: "normal",
});
loadLocalFont({
  family: "Fraunces Light",
  url: staticFile("fonts/Fraunces-Light-Italic.woff2"),
  weight: "200 600",
  style: "italic",
});

export const fonts = {
  display: '"Fraunces Light", serif',
  body: loadJakarta("normal", {
    weights: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext"],
  }).fontFamily,
  mono: loadJetBrainsMono("normal", {
    weights: ["400", "500"],
    subsets: ["latin", "latin-ext"],
  }).fontFamily,
};

/**
 * Instagram Stories / Reels frame (9:16). The margins keep every stat clear of
 * the UI Instagram draws on top: the progress bar and username at the top,
 * and the caption, reply box and Reels buttons at the bottom.
 */
export const layout = {
  width: 1080,
  height: 1920,
  /** Side gutter; also clears the Reels action buttons on the right. */
  gutter: 100,
  marginTop: 250,
  marginBottom: 400,
} as const;

/**
 * Largest font size (up to `max`) that fits `text` on one line across the
 * content width. A heuristic on Fraunces' average glyph width, so long
 * numbers shrink instead of overflowing. With `min`, text that would need
 * to go smaller stays at `min` and wraps instead (for long names).
 */
export function fitFontSize(
  text: string,
  max: number,
  width: number = layout.width - layout.gutter * 2,
  charWidth = 0.56,
  min = 0
): number {
  const fit = Math.floor(width / (Math.max(text.length, 1) * charWidth));
  return Math.max(min, Math.min(max, fit));
}

export const formatNumber = (n: number) => n.toLocaleString("en-NZ");

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
