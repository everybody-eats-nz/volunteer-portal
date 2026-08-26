import { prisma } from "@/lib/prisma";

/** Normalise a notes value the way the shift and template forms store it. */
function normaliseNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/**
 * Carry a template's notes through to the shifts it has already rostered.
 *
 * Only upcoming shifts are touched, and only the ones still carrying the
 * template's previous notes verbatim - a shift whose notes were edited on its
 * own keeps them. Returns how many shifts were updated.
 */
export async function applyTemplateNotesToUpcomingShifts({
  templateId,
  previousNotes,
  nextNotes,
  now = new Date(),
}: {
  templateId: string;
  previousNotes: string | null | undefined;
  nextNotes: string | null | undefined;
  now?: Date;
}): Promise<number> {
  const previous = normaliseNotes(previousNotes);
  const next = normaliseNotes(nextNotes);

  if (previous === next) return 0;

  const { count } = await prisma.shift.updateMany({
    where: {
      templateId,
      start: { gte: now },
      notes: previous,
    },
    data: { notes: next },
  });

  return count;
}

/**
 * How many upcoming shifts each template has on the roster, keyed by template
 * id. Used to tell admins what a notes edit is about to reach.
 */
export async function countUpcomingShiftsByTemplate(
  templateIds: string[],
  now: Date = new Date()
): Promise<Map<string, number>> {
  if (templateIds.length === 0) return new Map();

  const grouped = await prisma.shift.groupBy({
    by: ["templateId"],
    where: {
      templateId: { in: templateIds },
      start: { gte: now },
    },
    _count: { _all: true },
  });

  return new Map(
    grouped.flatMap((row) =>
      row.templateId ? [[row.templateId, row._count._all] as const] : []
    )
  );
}
