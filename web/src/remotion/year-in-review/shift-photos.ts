/**
 * Photos from the mobile app's shift covers (`SHIFT_COVERS` in
 * mobile/lib/dummy-data.ts), exported at up to 1000px wide into
 * `public/year-in-review/` and named after the app's keys. All but the
 * dining room and the catering spread are cropped so nobody's face is in
 * them: everyone else's year is in these videos too.
 */
export type Photo =
  | "dining-room"
  | "service-pass"
  | "community-table"
  | "dishwasher"
  | "kitchen-prep"
  | "kitchen-team"
  | "chef-plating"
  | "foh-serving"
  | "foh-portrait"
  | "crew-plates"
  | "catering-spread"
  | "serving-plates"
  | "cafe-helpers";

// The app's exact shift type names. "Front of House" is the one exception:
// the app's photo for it is a portrait in a full room with no face-free
// crop worth showing, so it gets the photo the app shows for every other
// front-of-house shift.
const BY_NAME: Record<string, Photo> = {
  "Front of House": "foh-portrait",
  "Kitchen Prep": "kitchen-prep",
  "Kitchen Service & Pack Down": "service-pass",
  "FOH Set-Up & Service": "foh-serving",
  Kitchen: "kitchen-team",
  "Kitchen Prep & Service": "chef-plating",
  Dishwasher: "dishwasher",
  FOH: "dining-room",
  "Media Role": "community-table",
  "Cafe Helpers": "cafe-helpers",
};

// The app's keyword fallbacks, in its order: the first match wins.
const BY_KEYWORD: readonly (readonly [readonly string[], Photo])[] = [
  [["cafe", "café", "barista"], "cafe-helpers"],
  [["dishwash"], "dishwasher"],
  [["food rescue", "rescue"], "catering-spread"],
  [["save a bite"], "serving-plates"],
  [["photograph", "socials", "media"], "service-pass"],
  [["moving", "packing", "sorting"], "crew-plates"],
  // The app shows its front-of-house portrait here too; see BY_NAME.
  [["offsite"], "foh-portrait"],
  [["front of house", "foh"], "foh-portrait"],
  [["clean"], "dishwasher"],
  [["kitchen prep", "prep"], "kitchen-prep"],
  [["kitchen"], "kitchen-team"],
  [["set up", "setup"], "community-table"],
  [["information", "info session", "session"], "dining-room"],
  [["event"], "community-table"],
  [["service", "serving"], "foh-serving"],
];

/**
 * The photo for a shift type, chosen the way the mobile app picks its shift
 * cover (`getShiftThemeByName`): exact name, then keywords, then the dining
 * room. Keep the two in step.
 */
export function shiftTypePhoto(name: string): Photo {
  const exact = BY_NAME[name];
  if (exact) return exact;

  // Flatten hyphens and slashes, as the app does, so "Front-of-House" and
  // "Helper/Prep" still match.
  const normalized = name.toLowerCase().replace(/[-/]/g, " ");
  for (const [keywords, photo] of BY_KEYWORD) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return photo;
  }
  return "dining-room";
}
