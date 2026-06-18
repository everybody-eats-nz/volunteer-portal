/**
 * Resolve the description shown to volunteers for a shift.
 *
 * Per-shift notes (set on the shift template and copied onto the shift at
 * creation, or edited per shift) are the canonical description. The shift
 * type's generic description is only the fallback when a shift has no notes.
 */
export function getShiftDescription(
  notes?: string | null,
  shiftTypeDescription?: string | null
): string | null {
  const trimmedNotes = notes?.trim();
  if (trimmedNotes) return trimmedNotes;
  return shiftTypeDescription ?? null;
}
