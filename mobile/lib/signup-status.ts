/**
 * Signup status as volunteers see it. A signup only counts as a place on a
 * shift once an admin confirms it: PENDING is a request, WAITLISTED is a
 * queue. The app keeps the three apart everywhere it shows who is going.
 *
 * REGULAR_PENDING is folded into PENDING: the distinction is an admin one and
 * means nothing to the volunteer waiting to hear back.
 */
export type SignupStatus = "CONFIRMED" | "PENDING" | "WAITLISTED";

/** Older API builds omit the status; treat those signups as confirmed. */
export function normalizeSignupStatus(status?: string | null): SignupStatus {
  if (status === "PENDING" || status === "REGULAR_PENDING") return "PENDING";
  if (status === "WAITLISTED") return "WAITLISTED";
  return "CONFIRMED";
}

/**
 * How many volunteers with `status` are on a shift but not shown by name.
 *
 * The signups list carries everyone with an active signup, including the
 * current user, while only friends and PUBLIC profiles can be listed. The
 * remainder is summarised as "and N other volunteers".
 */
export function countUnnamedVolunteers({
  status,
  signupStatuses,
  myStatus,
  namedCount,
}: {
  status: SignupStatus;
  /** Status of every active signup on the shift, including the current user's. */
  signupStatuses: SignupStatus[];
  /** The current user's status on this shift, or null if they aren't signed up. */
  myStatus: SignupStatus | null;
  /** How many volunteers with this status are already listed by name. */
  namedCount: number;
}): number {
  const total = signupStatuses.filter((s) => s === status).length;
  const self = myStatus === status ? 1 : 0;
  return Math.max(0, total - self - namedCount);
}
