import { z } from "zod";
import { LOCATIONS } from "@/lib/locations";

// Location validation schema
export const LocationSchema = z.enum(LOCATIONS);

// Reusable location validation for Zod schemas
export function createLocationEnum() {
  return z.enum(LOCATIONS);
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
  protein: optionalString,
});

export type RestaurantNightStatsInput = z.infer<
  typeof restaurantNightStatsSchema
>;