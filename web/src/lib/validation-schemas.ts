import { z } from "zod";
import { LOCATIONS } from "@/lib/locations";

// Location validation schema
export const LocationSchema = z.enum(LOCATIONS);

// Reusable location validation for Zod schemas
export function createLocationEnum() {
  return z.enum(LOCATIONS);
}