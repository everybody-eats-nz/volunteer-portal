import { describe, it, expect } from "vitest";
import { getShiftTheme, DEFAULT_THEME, SHIFT_THEMES } from "./shift-themes";

describe("getShiftTheme", () => {
  // The full set of live shift-type names (from production) mapped to the emoji
  // each should resolve to. This is the real-world coverage guarantee: every
  // production shift type gets a role-appropriate theme, none fall to default.
  // The same names + emoji are expected to resolve identically in the mobile
  // app (mobile/lib/dummy-data.ts) — keep both in sync.
  //
  // NOTE: if these tests fail after a production change, it most likely means a
  // shift-type name was renamed (or a new type was added) in the database.
  // Update this array to match the new reality and confirm the keyword rules in
  // shift-themes.ts still resolve it correctly — that's expected maintenance,
  // not a regression.
  const PRODUCTION_SHIFT_TYPES: [name: string, emoji: string][] = [
    ["Dishwasher", "🧽"], // exact
    ["Event Front-of-House", "✨"], // foh keyword (hyphen normalised)
    ["Event Helpers", "🎉"], // event
    ["Event Prep", "🔪"], // prep
    ["Event Prep - Dishwashing", "🧽"], // dishwash wins over prep (order)
    ["Event Set-up", "🛠️"], // set up wins over event (order)
    ["Extra Cleaning Helper", "🧹"], // clean
    ["FOH Set-Up & Service", "✨"], // exact
    ["Food Rescue Helper", "🥕"], // rescue
    ["Food Rescue Helper & Prep", "🥕"], // rescue wins over prep (order)
    ["Front of House", "🌟"], // exact
    ["Front of House Service & Clean Up", "✨"], // foh wins over clean (order)
    ["Information Session", "📋"], // information/session
    ["Kitchen Prep", "🔪"], // exact
    ["Kitchen Prep & Service", "🍳"], // exact
    ["Kitchen Service & Pack Down", "📦"], // exact
    ["Media Role", "📷"], // exact
    ["Moving, Packing, Sorting", "📦"], // moving
    ["Offsite help", "🚚"], // offsite
    ["Photography & Socials", "📷"], // photograph
    ["Save a Bite", "🥪"], // save a bite
    ["Save a Bite Dinner -  Social & Planning Session  ONE", "🥪"],
    ["Save a Bite Dinner -  Social & Planning Session GI", "🥪"],
    ["Save a Bite Pop-Up GI", "🥪"],
    ["Save a Bite Pop-Up Stand GI", "🥪"],
    ["Save a Bite Pop-Up Stand ONE", "🥪"],
    ["Set-up Only", "🛠️"], // set up
    ["Special Event", "🎉"], // event
    ["Sunday Kitchen Prep (Onehunga)", "🔪"], // kitchen prep (location suffix)
  ];

  it.each(PRODUCTION_SHIFT_TYPES)(
    "resolves %s to %s",
    (name, expectedEmoji) => {
      expect(getShiftTheme(name).emoji).toBe(expectedEmoji);
    },
  );

  it("never falls back to the generic default for any live shift type", () => {
    for (const [name] of PRODUCTION_SHIFT_TYPES) {
      expect(getShiftTheme(name)).not.toBe(DEFAULT_THEME);
    }
  });

  it("prefers an exact match over a keyword match", () => {
    // "Kitchen" exactly maps to 🧽; the 'kitchen' keyword would give 🍳.
    expect(getShiftTheme("Kitchen")).toBe(SHIFT_THEMES["Kitchen"]);
    expect(getShiftTheme("Kitchen").emoji).toBe("🧽");
  });

  it("normalises hyphens so 'Front-of-House' matches the foh keyword", () => {
    expect(getShiftTheme("Front-of-House").emoji).toBe("✨");
  });

  it("respects keyword order: 'set up' beats 'event'", () => {
    expect(getShiftTheme("Event Set-up").emoji).toBe("🛠️");
  });

  it("respects keyword order: 'front of house' beats 'clean'", () => {
    expect(getShiftTheme("Front of House Service & Clean Up").emoji).toBe("✨");
  });

  it("respects keyword order: 'dishwash' beats 'prep'", () => {
    expect(getShiftTheme("Event Prep - Dishwashing").emoji).toBe("🧽");
  });

  it("returns the default theme for unrecognised names", () => {
    expect(getShiftTheme("Mystery Role")).toBe(DEFAULT_THEME);
    expect(getShiftTheme("")).toBe(DEFAULT_THEME);
  });

  it("always returns a complete theme object (no missing class fields)", () => {
    const fields = [
      "emoji",
      "borderColor",
      "textColor",
      "gradient",
      "bgColor",
      "fullGradient",
    ] as const;
    const names = [
      ...PRODUCTION_SHIFT_TYPES.map(([n]) => n),
      "Totally Unknown Shift",
    ];
    for (const name of names) {
      const theme = getShiftTheme(name);
      for (const field of fields) {
        expect(theme[field], `${name}.${field}`).toBeTruthy();
      }
    }
  });
});
