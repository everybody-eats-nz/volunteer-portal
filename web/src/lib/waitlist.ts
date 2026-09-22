/**
 * Volunteer-facing waitlist copy.
 *
 * A waitlist place is not a spot on the shift, and the difference decides
 * whether someone keeps their evening free. Volunteers told us they could not
 * make an educated call about staying on standby because they had no idea
 * whether two people were waiting or twenty — so every surface that mentions
 * the waitlist shows the size of it, worded from these helpers so the numbers
 * read the same way everywhere.
 */

/** Compact chip/inline label, e.g. "7 waiting". */
export function waitlistChipLabel(count: number): string {
  return `${count} waiting`;
}

/**
 * Label for a stats line, e.g. "7 on the waitlist". Names the list rather than
 * just the number, for places where "waiting" alone could be misread as
 * something else on the row.
 */
export function waitlistCountLabel(count: number): string {
  return `${count} on the waitlist`;
}

/** Sentence for someone deciding whether to join, e.g. "7 volunteers are on the waitlist." */
export function waitlistSizeSentence(count: number): string {
  // Being first is the useful thing to know here, not that the list is empty.
  if (count === 0) return "You'd be first on the waitlist.";
  if (count === 1) return "1 volunteer is on the waitlist.";
  return `${count} volunteers are on the waitlist.`;
}

/**
 * Sentence for someone already waitlisted. `count` includes them, which is how
 * every caller counts the list — don't subtract the viewer first.
 */
export function yourWaitlistStandingSentence(count: number): string {
  if (count <= 1) return "You're the only person on the waitlist.";
  return `You're one of ${count} people on the waitlist.`;
}

/**
 * How the list actually clears.
 *
 * Deliberately promises no queue position - saying "you're 3rd" would imply an
 * order the portal doesn't keep. It does now promise that a freed place is
 * offered automatically: if a confirmed volunteer cancels, the place goes
 * straight to the longest-waiting person the auto-approval rules already
 * trust. Anyone else on the list is still the team's call.
 */
export const WAITLIST_EXPLAINER =
  "If a confirmed volunteer cancels, the place is offered to whoever has been waiting longest - so keep an eye out, you'll have a short window to say yes.";
