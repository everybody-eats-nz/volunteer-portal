import { z } from "zod";
import { getActiveLocationNames } from "@/lib/locations";

/**
 * Build a Zod schema that validates a value is one of the currently active
 * location names. Queries the database on each call, so locations created at
 * runtime validate immediately (a module-level enum would be frozen at import
 * time and reject new locations until the server restarted).
 *
 * Falls back to a non-empty string check when no active locations exist, since
 * `z.enum` requires a non-empty set.
 */
export async function createLocationEnum() {
  const names = await getActiveLocationNames();
  if (names.length === 0) {
    return z.string().min(1);
  }
  return z.enum(names as [string, ...string[]]);
}

// --- Restaurant service-night stats ---

// Accepts numbers or numeric strings from form inputs; "" / null / undefined → null.
const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  });

const optionalInt = optionalNumber.transform((v) =>
  v === null ? null : Math.trunc(v)
);

const optionalMoney = optionalNumber.transform((v) =>
  v === null ? null : Math.round(v * 100) / 100
);

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  });

// Body for POST /api/admin/meals-served — a full service-night record.
// `date` (YYYY-MM-DD) and `location` identify the night; everything else is optional.
export const restaurantNightStatsSchema = z.object({
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  mealsServed: optionalInt, // customers / people served (headline count)
  notes: optionalString,
  weather: optionalString,
  bookingsPax: optionalInt,
  // newVolunteers is derived from attendance server-side, not entered.
  nonPayingCount: optionalInt, // ratio is derived from this / customers
  vege: optionalInt, // number of vegetarian meals
  takeaways: optionalInt,
  eftposTransactions: optionalInt,
  cash: optionalMoney,
  eftpos: optionalMoney,
  stripe: optionalMoney,
  suggestedValue: optionalMoney,
  protein: optionalString,
});

export type RestaurantNightStatsInput = z.infer<
  typeof restaurantNightStatsSchema
>;

// --- Admin volunteer movement ---

/**
 * Body for POST /api/admin/volunteer-movement.
 *
 * Ids are checked for presence, never for shape. Signups created for regular
 * volunteers used to be given UUIDs rather than cuids, so a cuid format check
 * rejected every regular's signup with a bare "Invalid input" - admins could
 * not move their weekly regulars between shifts on the day. Whether an id
 * points at a real row is the database's answer to give, not a regex's.
 */
export const moveVolunteerSchema = z.object({
  signupId: z
    .string({ error: "No volunteer selected to move" })
    .min(1, "No volunteer selected to move"),
  targetShiftId: z
    .string({ error: "Choose a shift to move them to" })
    .min(1, "Choose a shift to move them to"),
  movementNotes: z.string({ error: "Notes must be text" }).optional(),
});

export type MoveVolunteerInput = z.infer<typeof moveVolunteerSchema>;
