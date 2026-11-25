/**
 * Email address helpers.
 *
 * User emails were historically stored exactly as typed, so the database
 * holds a mix of casings ("Jane@Example.com", "jane@example.com"). Every
 * lookup driven by something the user typed (login, forgot password,
 * registration duplicate checks, invitations) must therefore be
 * case-insensitive, and every new write should store the canonical form so
 * the data converges over time.
 */

/** Canonical form for storing and comparing an email address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Most accounts a single address can plausibly resolve to. Legacy rows can
 * differ only by casing, so a lookup may return more than one; anything past a
 * handful is not a real address and must not turn one sign-in attempt into a
 * password check against many accounts.
 */
export const MAX_EMAIL_CANDIDATES = 5;

/**
 * Whether the text has the basic shape of an email address. Deliberately
 * loose: it exists to turn away junk before a lookup, not to validate
 * deliverability.
 */
export function isPlausibleEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(trimmed);
}

/**
 * Prisma filter for a case-insensitive exact match on a string column.
 *
 * Prisma compiles `{ equals, mode: "insensitive" }` to PostgreSQL `ILIKE`
 * without escaping the value, so `%` and `_` in it act as wildcards: an
 * "email" of `%` would match every row. Escaping them (and the escape
 * character itself) makes the comparison the exact match the name promises.
 */
export function insensitiveEquals(value: string) {
  return {
    equals: value.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive" as const,
  };
}

/**
 * Prisma `where` fragment for a case-insensitive exact match on `User.email`.
 *
 * Use with `findFirst` / `findMany` (Prisma's `findUnique` only accepts the
 * exact-match form).
 */
export function emailMatches(email: string) {
  return { email: insensitiveEquals(normalizeEmail(email)) };
}
