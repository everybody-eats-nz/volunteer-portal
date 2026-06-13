import { readFileSync } from "node:fs";
import path from "node:path";

// Curated landscape Everybody Eats photos — dining rooms, kitchens, food
// spreads and volunteer crews — used as full-bleed backgrounds on OG cards.
// They live in web/public/og-bg/. Next.js already caches ImageResponse output
// per-URL, so we don't add a second in-process cache here — the file read only
// fires on a cache miss.
const BG_FILES = [
  "bg-1.jpg",
  "bg-2.jpg",
  "bg-3.jpg",
  "bg-4.jpg",
  "bg-5.jpg",
  "bg-6.jpg",
  "bg-7.jpg",
  "bg-8.jpg",
] as const;

function loadDataUrl(filename: string): string {
  const buf = readFileSync(path.join(process.cwd(), "public/og-bg", filename));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

// Deterministic 32-bit hash so the same seed always maps to the same image.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getOgBackgroundDataUrl(seed: string): string {
  const index = hash(seed) % BG_FILES.length;
  return loadDataUrl(BG_FILES[index]);
}
