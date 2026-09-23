/**
 * Time predicates for a shift window.
 *
 * These compare absolute instants, never calendar components, so a volunteer
 * or admin whose phone is in another timezone gets the same answer as the
 * server does.
 */

/**
 * Has the shift begun? True for the whole shift and for every shift after it.
 *
 * This is the line attendance is recorded against - the team knows who walked
 * in from the moment service starts, so no-shows are marked from the start
 * time rather than waiting for the shift to finish. Mirrors `isShiftStarted`
 * in the web app's `shift-utils.ts`, which the API enforces.
 */
export function isShiftStarted(startIso: string | null | undefined): boolean {
  if (!startIso) return false;
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() >= start;
}

/** Is the shift running right now? */
export function isShiftInProgress(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): boolean {
  if (!startIso || !endIso) return false;
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}
