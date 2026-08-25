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

/** Sentence for someone deciding whether to join, e.g. "7 volunteers are on the waitlist." */
export function waitlistSizeSentence(count: number): string {
  if (count === 0) return "No one is on the waitlist yet.";
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
 * How the list actually clears. Admins confirm waitlisted volunteers by hand,
 * so this promises no queue position — saying "you're 3rd" would imply an
 * order the portal doesn't keep.
 */
export const WAITLIST_EXPLAINER =
  "A place opens up only if a confirmed volunteer cancels, and the team picks who comes off the list.";
