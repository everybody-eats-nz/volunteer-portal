import { prisma } from "@/lib/prisma";
import { normalizeLocationName } from "@/lib/locations";

export type CreateShiftData = {
  shiftTypeId: string;
  location: string;
  start: Date;
  end: Date;
  capacity: number;
  notes?: string | null;
  /** Set when the shift is rostered from a template, so later template notes edits can reach it. */
  templateId?: string | null;
  /** Off for special events the team hand-picks. Defaults to on. */
  autoApprovalEnabled?: boolean;
};

/**
 * Read the shift form's auto-approval toggle (`AutoApprovalToggle`). Missing
 * means on, so older forms and API callers keep today's behaviour.
 */
export function parseAutoApprovalEnabled(
  value: FormDataEntryValue | null | undefined
): boolean {
  return value !== "0" && value !== "false";
}

/**
 * Core shift creation logic
 * Used by both server actions and API endpoints
 *
 * The location is normalized on the way in: the admin schedule filters shifts
 * by an exact `Location.name` match, so a shift stored with stray whitespace
 * is invisible there even though the volunteer-facing browse page (which
 * normalizes before matching) still lists it.
 */
export async function createShiftRecord(data: CreateShiftData) {
  return await prisma.shift.create({
    data: {
      shiftTypeId: data.shiftTypeId,
      start: data.start,
      end: data.end,
      location: normalizeLocationName(data.location),
      capacity: data.capacity,
      notes: data.notes ?? null,
      templateId: data.templateId ?? null,
      autoApprovalEnabled: data.autoApprovalEnabled ?? true,
    },
  });
}
