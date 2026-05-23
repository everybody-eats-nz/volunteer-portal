import { readFileSync } from "node:fs";
import path from "node:path";

// The brand logo ships as `public/logo.svg` with fill="white". We recolor it
// at runtime for the light-background variants of the OG cards.
let cachedSvg: string | null = null;

function loadSvg(): string {
  if (cachedSvg) return cachedSvg;
  cachedSvg = readFileSync(
    path.join(process.cwd(), "public/logo.svg"),
    "utf8"
  );
  return cachedSvg;
}

export type LogoColor = "white" | "ink";

const COLOR_HEX: Record<LogoColor, string> = {
  white: "#ffffff",
  ink: "#0e3a23",
};

export function getLogoDataUrl(color: LogoColor = "ink"): string {
  const target = COLOR_HEX[color];
  // The logo paths use `fill="white"` directly — swap that token for whatever
  // colour the OG variant wants.
  const svg = loadSvg().replaceAll('fill="white"', `fill="${target}"`);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Native logo dimensions (matches the viewBox in logo.svg).
export const LOGO_NATIVE_WIDTH = 179;
export const LOGO_NATIVE_HEIGHT = 65;
