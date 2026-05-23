import { readFileSync } from "node:fs";
import path from "node:path";

// 4 curated landscape photos from the marketing assets — community-vibe shots
// used as full-bleed backgrounds on OG cards. They live in web/public/og-bg/.
const BG_FILES = ["bg-1.jpg", "bg-2.jpg", "bg-3.jpg", "bg-4.jpg"] as const;

const cache = new Map<string, string>();

function loadDataUrl(filename: string): string {
  const cached = cache.get(filename);
  if (cached) return cached;
  const buf = readFileSync(path.join(process.cwd(), "public/og-bg", filename));
  const dataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
  cache.set(filename, dataUrl);
  return dataUrl;
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
