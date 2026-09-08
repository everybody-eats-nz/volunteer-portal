/**
 * One rule, used by both the warning the driver sees at the end of a trip and
 * the exception the office sees later. Keeping them in the same function is the
 * point: a trip must never warn the driver and then look clean on the admin
 * list, or the reverse.
 */

export const MAX_PLAUSIBLE_KM = 400;
export const MAX_PLAUSIBLE_AVG_SPEED = 110;
/** Under this, an average speed says more about when the driver opened the trip. */
export const SHORT_TRIP_HOURS = 0.5;
export const MAX_SHORT_TRIP_KM = 60;

export function isImplausible(distanceKm: number, hours: number): boolean {
  if (distanceKm > MAX_PLAUSIBLE_KM) return true;
  if (hours < SHORT_TRIP_HOURS) return distanceKm > MAX_SHORT_TRIP_KM;
  return distanceKm / hours > MAX_PLAUSIBLE_AVG_SPEED;
}

/**
 * Why it looks wrong, phrased for whoever is reading it.
 *
 * Where more than one rule catches a reading, the sentence names whichever is
 * hardest to argue with, not whichever is checked first. 512 km in two hours
 * breaks both the distance cap and the speed limit, and "256 km/h" makes the
 * mistyped digit obvious in a way "over 400 km" does not.
 *
 * The speed is quoted only when it is the rule that fired. A van out for four
 * days that comes back 699 km later was being explained as "that averages
 * 6 km/h" — which is not merely unhelpful, it is an argument *for* the reading,
 * and a warning that argues against itself is one drivers learn to tap past.
 */
export function explainImplausible(distanceKm: number, hours: number): string {
  if (
    hours >= SHORT_TRIP_HOURS &&
    distanceKm / hours > MAX_PLAUSIBLE_AVG_SPEED
  ) {
    return `That averages ${Math.round(
      distanceKm / hours
    )} km/h for the whole trip, loading included. Usually it means a digit is wrong.`;
  }
  if (distanceKm > MAX_PLAUSIBLE_KM) {
    return `That is over ${MAX_PLAUSIBLE_KM} km in a single trip, further than these vans go. Usually it means a digit is wrong.`;
  }
  return "That is a long way for the time the van has been out. Usually it means a digit is wrong.";
}

export const hoursBetween = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / 3_600_000;
