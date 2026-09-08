/**
 * Whether `next/image` is allowed to optimise a van photo's source.
 *
 * `next/image` does not degrade when a src points at a host missing from
 * `remotePatterns` — it throws, and one bad row takes the whole Vans page down
 * to the error boundary. Photos are uploaded to Supabase now, but the field the
 * fleet screen replaced was a free-text URL box, so a vehicle in production can
 * hold any host at all. Anything we cannot prove is configured renders
 * unoptimised instead: the photo still shows, and it cannot throw.
 */
export function canOptimiseImage(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return new URL(src).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}
