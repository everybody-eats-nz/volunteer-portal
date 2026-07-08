import type { SignupStatus } from "@/generated/client";

/**
 * Signup statuses that count as an active volunteer commitment on a shift.
 * Used when reporting how many volunteers a shift deletion affects.
 */
export const ACTIVE_SIGNUP_STATUSES: SignupStatus[] = [
  "CONFIRMED",
  "PENDING",
  "WAITLISTED",
  "REGULAR_PENDING",
];
