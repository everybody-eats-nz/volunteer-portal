import type { SignupStatus } from "@/lib/signup-status";

/**
 * The shape the shifts list needs from a volunteer to describe who is on a
 * shift. Kept structural so the richer `PeriodFriend` the API returns passes
 * straight through.
 */
export type ShiftVolunteer = {
  id: string;
  name: string;
  status: SignupStatus;
};

/**
 * Split volunteers by what their signup actually is. Only a CONFIRMED signup is
 * a place on the shift — PENDING is a request an admin has yet to approve, so
 * the two are never counted together. WAITLISTED signups belong to neither
 * group: a queue place isn't a spot, and it isn't waiting on approval either.
 */
export function splitBySignupStatus<T extends ShiftVolunteer>(
  volunteers: T[]
): { going: T[]; waiting: T[] } {
  return {
    going: volunteers.filter((v) => v.status === "CONFIRMED"),
    waiting: volunteers.filter((v) => v.status === "PENDING"),
  };
}

/**
 * Fold several roles' volunteer lists into one, keyed by person. A volunteer
 * can hold two roles in the same Day/Evening session — a confirmed spot on
 * either means they are on that session, so it wins over a pending one.
 */
export function mergeVolunteers<T extends ShiftVolunteer>(lists: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) {
    for (const volunteer of list) {
      const seen = byId.get(volunteer.id);
      if (seen?.status === "CONFIRMED") continue;
      byId.set(volunteer.id, volunteer);
    }
  }
  return Array.from(byId.values());
}

function firstNameOf(volunteer: ShiftVolunteer): string {
  return volunteer.name.split(" ")[0];
}

/**
 * The one-line summary under a shift card. It leads with whoever is confirmed;
 * when nobody is, it says people are waiting rather than claiming they're
 * going. On a mixed shift the waiting count rides in the chip beside this line.
 *
 * `viewerIsSignedUp` switches the line to the "With …" phrasing used when the
 * volunteer is reading their own shift.
 */
export function friendsLine(
  going: ShiftVolunteer[],
  waiting: ShiftVolunteer[],
  viewerIsSignedUp: boolean
): string {
  if (going.length > 0) {
    const first = firstNameOf(going[0]);
    if (going.length === 1) {
      return viewerIsSignedUp ? `With ${first}` : `${first} is signed up`;
    }
    if (going.length === 2) {
      const second = firstNameOf(going[1]);
      return viewerIsSignedUp
        ? `With ${first} & ${second}`
        : `${first} & ${second} are going`;
    }
    return viewerIsSignedUp
      ? `With ${first} + ${going.length - 1} more`
      : `${first} + ${going.length - 1} others going`;
  }

  if (waiting.length === 0) return "";
  const first = firstNameOf(waiting[0]);
  if (waiting.length === 1) return `${first} is waiting on approval`;
  if (waiting.length === 2) {
    return `${first} & ${firstNameOf(waiting[1])} are waiting on approval`;
  }
  return `${first} + ${waiting.length - 1} others waiting on approval`;
}

/**
 * The count beside a Day/Evening header. "N volunteers" is confirmed-only; the
 * approval queue is named separately so it is never read as part of that count.
 */
export function periodVolunteersLabel(
  going: ShiftVolunteer[],
  waiting: ShiftVolunteer[]
): string {
  const goingLabel =
    going.length > 0
      ? `${going.length} ${going.length === 1 ? "volunteer" : "volunteers"}`
      : "";
  if (waiting.length === 0) return goingLabel;
  // Beside a confirmed count the word "waiting" is unambiguous; on its own it
  // needs to say what the wait is for.
  return goingLabel
    ? `${goingLabel} · ${waiting.length} waiting`
    : `${waiting.length} waiting on approval`;
}
