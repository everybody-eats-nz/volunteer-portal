/**
 * Volunteer-facing waitlist copy, mirrored from the web portal
 * (`web/src/lib/waitlist.ts`) so both apps describe standby the same way.
 *
 * Volunteers had no way to tell whether two people or twenty were waiting for
 * the same shift, which made holding a standby place a coin flip. Every
 * waitlist surface shows the size of the list, worded from here.
 */

/** Compact label for stat cells and chips, e.g. "7 waiting". */
export function waitlistChipLabel(count: number): string {
  return `${count} waiting`;
}

/** Label for a stats or meta line, e.g. "7 on the waitlist". Names the list so
 * the number can't be misread as something else on the row. */
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
 * Sentence for someone already waitlisted. `count` includes them — callers
 * pass the whole list size, not the number of people ahead.
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
