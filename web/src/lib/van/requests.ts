import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * What a driver's device sends, validated in one place.
 *
 * The browser flow and the app's Drive tab post the same trip, so the rules
 * about what makes a startable one — an organisation that is still offerable,
 * a borrower named only where a name belongs, something said about what the
 * van is doing — live here rather than being retyped per route. `trips.ts`
 * owns the write; this owns the question of whether there is enough to write.
 */

export const startTripSchema = z.object({
  vehicleId: z.string().min(1),
  startOdo: z.number().int().positive(),
  startOdoPhotoUrl: z.string().nullable(),
  organisationId: z.string().min(1),
  externalOrgName: z.string().trim().min(2).max(120).nullable(),
  purposeId: z.string().nullable(),
  purposeOther: z.string().trim().min(3).max(500).nullable(),
});

export type StartTripRequest = z.infer<typeof startTripSchema>;

export const endTripSchema = z.object({
  endOdo: z.number().int().positive(),
  endOdoPhotoUrl: z.string().nullable(),
  /** The driver was warned the reading looked wrong and confirmed it anyway. */
  acknowledgedWarning: z.boolean().default(false),
});

export const tripNotesSchema = z.object({ notes: z.string().max(2000) });

/**
 * Null when the trip is startable; otherwise the sentence to show the driver.
 * Everything checked here is a question the driver can answer on the screen
 * they are already looking at — nothing infrastructural blocks a trip.
 */
export async function checkStartTripRequest(
  input: StartTripRequest
): Promise<string | null> {
  // An external trip describes its use in free text; an internal one carries a
  // purpose. One or the other has to be there or the report cannot break the
  // trip down at all.
  if (!input.purposeId && !input.purposeOther) {
    return "Say what the van is doing.";
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: input.organisationId },
  });
  if (!organisation || !organisation.isActive) {
    return "That organisation is not on the list.";
  }
  // Only the catch-all row carries a typed-in borrower name.
  if (!organisation.isCatchAll && input.externalOrgName) {
    return "That organisation does not take a name.";
  }
  if (organisation.isCatchAll && !input.externalOrgName) {
    return "Say who is borrowing the van.";
  }
  return null;
}
