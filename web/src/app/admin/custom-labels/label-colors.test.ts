import { describe, it, expect } from "vitest";
import {
  getColorFamily,
  getLabelTheme,
  firstGrapheme,
  COLOR_OPTIONS,
  FAMILY_THEME,
} from "./label-colors";

describe("getColorFamily", () => {
  it("extracts the family from the text- token", () => {
    expect(getColorFamily("bg-purple-50 text-purple-700 border-purple-200")).toBe(
      "purple"
    );
  });

  it("handles colour strings that include dark-mode classes", () => {
    expect(
      getColorFamily(
        "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"
      )
    ).toBe("blue");
  });

  it("recognises every palette option", () => {
    for (const option of COLOR_OPTIONS) {
      expect(getColorFamily(option.value)).toBe(option.family);
    }
  });

  it("falls back to slate for unknown colours", () => {
    expect(getColorFamily("bg-cornflower-50 text-cornflower-700")).toBe("slate");
  });

  it("falls back to slate for null/empty input", () => {
    expect(getColorFamily(null)).toBe("slate");
    expect(getColorFamily(undefined)).toBe("slate");
    expect(getColorFamily("")).toBe("slate");
  });

  it("falls back to a family found anywhere when no text- token exists", () => {
    expect(getColorFamily("bg-teal-100 border-teal-200")).toBe("teal");
  });
});

describe("getLabelTheme", () => {
  it("returns the theme tokens for the derived family", () => {
    expect(getLabelTheme("text-emerald-700")).toBe(FAMILY_THEME.emerald);
  });

  it("returns the slate theme as a safe default", () => {
    expect(getLabelTheme("not-a-colour")).toBe(FAMILY_THEME.slate);
  });
});

describe("firstGrapheme", () => {
  it("returns an empty string for empty input", () => {
    expect(firstGrapheme("")).toBe("");
  });

  it("keeps a simple emoji intact", () => {
    expect(firstGrapheme("⭐")).toBe("⭐");
  });

  it("preserves a multi-code-unit emoji (variation selector)", () => {
    expect(firstGrapheme("🎖️")).toBe("🎖️");
  });

  it("preserves a skin-tone modified emoji as one grapheme", () => {
    expect(firstGrapheme("👍🏽")).toBe("👍🏽");
  });

  it("takes only the first grapheme when several are pasted", () => {
    expect(firstGrapheme("⭐🔥💎")).toBe("⭐");
  });

  it("takes the first character of plain text", () => {
    expect(firstGrapheme("AB")).toBe("A");
  });
});
