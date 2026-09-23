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
 * Prisma `where` fragment for a case-insensitive exact match on `User.email`.
 *
 * Use with `findFirst` / `findMany` (Prisma's `findUnique` only accepts the
 * exact-match form).
 */
export function emailMatches(email: string) {
  return {
    email: { equals: normalizeEmail(email), mode: "insensitive" as const },
  };
}
