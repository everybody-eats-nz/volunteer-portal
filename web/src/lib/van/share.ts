/**
 * How the month's kilometres divide up.
 *
 * "A monthly breakdown of how the vans are used" is the thing Everybody Eats
 * actually owes Meridian, so the split by who a trip was for — and by what it
 * was for — is report content rather than decoration. This module is the
 * arithmetic behind it; the drawing is in the ledger head.
 */

/** Brand-anchored categorical hues, validated for CVD separation and for
 *  contrast against both the light and dark card surfaces. Forest green leads
 *  because slot one is almost always Everybody Eats itself. The order is fixed:
 *  hues are assigned in it and never cycled. */
export const SHARE_HUES = [
  "#2f7d4f",
  "#4a6ae0",
  "#c9770c",
  "#b8367f",
  "#8a9a22",
] as const;

/** The residual bucket. Neutral on purpose: it is a remainder, not an entity. */
export const OTHER_HUE = "#8a8f8b";
export const OTHER_KEY = "__other__";

export interface ShareSegment {
  key: string;
  label: string;
  color: string;
  km: number;
  trips: number;
  /** 0–100, for the bar's width and the legend's figure. */
  percent: number;
}

interface ShareInput {
  distanceKm: number | null;
}

/**
 * Which entities get their own hue, decided once over the whole record.
 *
 * Colour follows the entity, never its rank in the current view: if the ramp
 * were assigned to whatever is biggest *after* filtering, narrowing to one van
 * would repaint every organisation that survived. So the five largest over all
 * trips keep their hue no matter what the filters do, and everything else is
 * the neutral remainder.
 */
export function assignShareHues<T extends ShareInput>(
  rows: T[],
  keyOf: (row: T) => string,
  labelOf: (row: T) => string
): Map<string, { label: string; color: string }> {
  const totals = new Map<string, { label: string; km: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = totals.get(key);
    if (entry) entry.km += row.distanceKm ?? 0;
    else totals.set(key, { label: labelOf(row), km: row.distanceKm ?? 0 });
  }

  const ranked = [...totals.entries()].sort(
    // Ties break on the label so the assignment is stable across reloads
    // rather than left to insertion order.
    (a, b) => b[1].km - a[1].km || a[1].label.localeCompare(b[1].label)
  );

  return new Map(
    ranked.slice(0, SHARE_HUES.length).map(([key, entry], index) => [
      key,
      { label: entry.label, color: SHARE_HUES[index] },
    ])
  );
}

/** The split for one set of rows, largest first, with the remainder last. */
export function shareOf<T extends ShareInput>(
  rows: T[],
  keyOf: (row: T) => string,
  labelOf: (row: T) => string,
  hues: Map<string, { label: string; color: string }>
): ShareSegment[] {
  const buckets = new Map<string, ShareSegment>();

  for (const row of rows) {
    const raw = keyOf(row);
    const named = hues.get(raw);
    const key = named ? raw : OTHER_KEY;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.km += row.distanceKm ?? 0;
      bucket.trips += 1;
    } else {
      buckets.set(key, {
        key,
        label: named ? named.label : "Everyone else",
        color: named ? named.color : OTHER_HUE,
        km: row.distanceKm ?? 0,
        trips: 1,
        percent: 0,
      });
    }
    // A bucket named by a hue still takes its label from the row, so an
    // organisation renamed since the hue was assigned reads correctly.
    if (named) buckets.get(key)!.label = labelOf(row);
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.km, 0);
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      percent: total > 0 ? (bucket.km / total) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        // The remainder sits last whatever its size: it is not an entity, so
        // ranking it among them would read as one.
        Number(a.key === OTHER_KEY) - Number(b.key === OTHER_KEY) ||
        b.km - a.km ||
        a.label.localeCompare(b.label)
    );
}
