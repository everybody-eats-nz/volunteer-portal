import { loadFont as loadLocalFont } from "@remotion/fonts";
import { loadFont as loadDmMono } from "@remotion/google-fonts/DMMono";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { staticFile } from "remotion";

/** Everybody Eats brand palette, shared with the portal and marketing site. */
export const colors = {
  cream: "#fdf8ef",
  paper: "#ffffff",
  forest200: "#9bbda0",
  forest500: "#1d5337",
  forest700: "#0e2a1c",
  sun: "#edf03f",
  ink: "#14181c",
} as const;

// Fraunces with its soft, wonky, large-optical-size look baked in (only the
// weight axis is left variable), so the display style doesn't depend on
// font-variation-settings support wherever the video plays or renders.
// 57 KB instead of the 350 KB full variable font. Made from
// Fraunces-VariableFont.ttf with
// `fonttools varLib.instancer ... opsz=144 SOFT=100 WONK=1 wght=400:900`.
loadLocalFont({
  family: "Fraunces Display",
  url: staticFile("fonts/Fraunces-Display.woff2"),
  weight: "400 900",
});

export const fonts = {
  display: '"Fraunces Display", serif',
  body: loadJakarta("normal", {
    weights: ["500", "700", "800"],
    subsets: ["latin", "latin-ext"],
  }).fontFamily,
  docket: loadDmMono("normal", {
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
