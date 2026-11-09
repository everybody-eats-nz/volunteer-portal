/**
 * The cap on open shift applications.
 *
 * An application is a signup still waiting on a human: status PENDING on a
 * shift that hasn't started. Some volunteers applied for every shift going in
 * the hope of landing one, which buries the restaurant managers in requests
 * they then have to decline. Confirmed shifts never count, so a volunteer can
 * hold as many shifts as they like - only the "waiting for a reply" pile is
 * capped.
 *
 * Client-safe: the web dialog and the routes share these, and the mobile app
 * reads the same payload shapes.
 */
export const MAX_PENDING_APPLICATIONS = 5;

/** Where a volunteer stands against the cap, sent with the pre-signup check. */
export type ApplicationLimitStatus = {
  /** The cap itself, so clients never hard-code it. */
  limit: number;
  /** Open applications the volunteer has right now. */
  pending: number;
  /**
   * True when applying for this shift would be refused: the volunteer is at
   * the cap and this signup would not be approved instantly.
   */
  reached: boolean;
};

/** 400 payload returned when a signup is refused by the cap. */
export type ApplicationLimitError = {
  /**
   * The full volunteer-facing sentence. Clients that predate the cap show
   * `error` verbatim, so it has to read well on its own.
   */
  error: string;
  applicationLimitReached: true;
  applicationLimit: ApplicationLimitStatus;
};

/**
 * Volunteer-facing explanation of the cap, with the way out. Names no screen:
 * web and mobile both show it, and call their shift lists different things.
 */
export function buildApplicationLimitMessage(
  limit: number = MAX_PENDING_APPLICATIONS
): string {
  return `You have ${limit} shift applications waiting for a reply, which is the most you can have at once. Once one is confirmed, or you withdraw one, you can apply for another.`;
}

export function buildApplicationLimitError(
  status: ApplicationLimitStatus
): ApplicationLimitError {
  return {
    error: buildApplicationLimitMessage(status.limit),
    applicationLimitReached: true,
    applicationLimit: status,
  };
}
