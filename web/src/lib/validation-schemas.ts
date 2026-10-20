import { z } from "zod";
import { getActiveLocationNames } from "@/lib/locations";
import {
  DAY_REPORT_TYPES,
  EVENT_INCOME_CATEGORIES,
  EVENT_INCOME_SOURCES,
} from "@/lib/day-reports";

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

const optionalTime = optionalString.refine(
  (v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
  "Opening hours must be times like 07:30"
);

// One itemised line of event (fundraiser) takings.
export const eventIncomeLineSchema = z.object({
  source: z.enum(EVENT_INCOME_SOURCES, { error: "Choose where the money came in" }),
  category: z.enum(EVENT_INCOME_CATEGORIES, { error: "Choose an income category" }),
  description: optionalString.refine(
    (v) => v === null || v.length <= 120,
    "Keep income descriptions under 120 characters"
  ),
  // Blank must fail, not coerce to $0 (Number("") and Number(null) are 0).
  amount: z
    .preprocess(
      (v) =>
        v === null || (typeof v === "string" && v.trim() === "")
          ? undefined
          : v,
      z.coerce
        .number({ error: "Enter an amount for every income line" })
        .finite("Enter an amount for every income line")
        .min(0, "Income amounts can't be negative")
        .max(99_999_999.99, "That amount is too large")
    )
    .transform((v) => Math.round(v * 100) / 100),
  gstIncluded: z.boolean().default(false),
});

export type EventIncomeLineInput = z.infer<typeof eventIncomeLineSchema>;

// Body for POST /api/admin/meals-served — a full day report (service night,
// event or cafe). `date` (YYYY-MM-DD) and `location` identify the day;
// everything else is optional.
export const restaurantNightStatsSchema = z.object({
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  // Omitted by older clients: the day keeps the type it already has.
  reportType: z.enum(DAY_REPORT_TYPES).optional(),
  eventName: optionalString.refine(
    (v) => v === null || v.length <= 120,
    "Keep the event name under 120 characters"
  ),
  income: z
    .array(eventIncomeLineSchema)
    .max(100, "That's a lot of income lines - combine some")
    .default([]),
  opensAt: optionalTime,
  closesAt: optionalTime,
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
}).refine(
  (r) => !r.opensAt || !r.closesAt || r.closesAt > r.opensAt,
  { message: "Closing time must be after opening time", path: ["closesAt"] }
);

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
