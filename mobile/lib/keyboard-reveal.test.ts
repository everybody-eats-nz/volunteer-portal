import { describe, expect, it } from "vitest";

import { keyboardRevealOffset } from "@/lib/keyboard-reveal";

const GAP = 16;
const TOP_INSET = 62;

describe("keyboardRevealOffset", () => {
  it("puts a lone input one gap above the keyboard", () => {
    const input = { top: 700, bottom: 752, groupBottom: 752 };
    // 540pt of viewport is left above the keyboard.
    expect(keyboardRevealOffset(input, 540, GAP, TOP_INSET)).toBe(
      752 + GAP - 540
    );
  });

  it("asks for no scroll (zero or less) when the input is already clear", () => {
    const input = { top: 100, bottom: 152, groupBottom: 152 };
    expect(keyboardRevealOffset(input, 540, GAP, TOP_INSET)).toBeLessThanOrEqual(
      0
    );
  });

  it("shows the whole group when it fits above the keyboard", () => {
    // Email field with the password field and submit button below it.
    const email = { top: 700, bottom: 752, groupBottom: 934 };
    expect(keyboardRevealOffset(email, 540, GAP, TOP_INSET)).toBe(
      934 + GAP - 540
    );
  });

  it("gives every input in a group the same offset, so moving focus does not shift the form", () => {
    const email = { top: 700, bottom: 752, groupBottom: 934 };
    const password = { top: 764, bottom: 816, groupBottom: 934 };
    expect(keyboardRevealOffset(email, 540, GAP, TOP_INSET)).toBe(
      keyboardRevealOffset(password, 540, GAP, TOP_INSET)
    );
  });

  it("falls back to the input alone when the group would push it under the status bar", () => {
    // 300pt above the keyboard cannot hold a 400pt group.
    const input = { top: 700, bottom: 752, groupBottom: 1100 };
    expect(keyboardRevealOffset(input, 300, GAP, TOP_INSET)).toBe(
      752 + GAP - 300
    );
  });

  it("keeps the focused input below the top inset whenever it shows the group", () => {
    const input = { top: 700, bottom: 752, groupBottom: 934 };
    for (let visible = 200; visible <= 800; visible += 7) {
      const offset = keyboardRevealOffset(input, visible, GAP, TOP_INSET);
      const inputBottomOnScreen = input.bottom - offset;
      const inputTopOnScreen = input.top - offset;
      expect(inputBottomOnScreen).toBeLessThanOrEqual(visible - GAP);
      // Only checkable when there is room for the input at all.
      if (visible - TOP_INSET >= input.bottom - input.top + GAP * 2) {
        expect(inputTopOnScreen).toBeGreaterThanOrEqual(TOP_INSET);
      }
    }
  });

  it("never treats a group that ends above the input as the target", () => {
    const input = { top: 700, bottom: 752, groupBottom: 600 };
    expect(keyboardRevealOffset(input, 540, GAP, TOP_INSET)).toBe(
      752 + GAP - 540
    );
  });
});
