import { describe, it, expect } from "vitest";

import {
  WAITLIST_EXPLAINER,
  waitlistChipLabel,
  waitlistCountLabel,
  waitlistSizeSentence,
  yourWaitlistStandingSentence,
} from "./waitlist";

describe("waitlist copy", () => {
  describe("waitlistChipLabel", () => {
    it("stays compact for chips", () => {
      expect(waitlistChipLabel(0)).toBe("0 waiting");
      expect(waitlistChipLabel(1)).toBe("1 waiting");
      expect(waitlistChipLabel(20)).toBe("20 waiting");
    });
  });

  describe("waitlistCountLabel", () => {
    it("names the list so the number can't be misread", () => {
      expect(waitlistCountLabel(1)).toBe("1 on the waitlist");
      expect(waitlistCountLabel(7)).toBe("7 on the waitlist");
    });
  });

  describe("waitlistSizeSentence", () => {
    it("tells the first joiner they'd be first, not that the list is empty", () => {
      expect(waitlistSizeSentence(0)).toBe("You'd be first on the waitlist.");
    });

    it("pluralises volunteers", () => {
      expect(waitlistSizeSentence(1)).toBe("1 volunteer is on the waitlist.");
      expect(waitlistSizeSentence(12)).toBe("12 volunteers are on the waitlist.");
    });
  });

  describe("yourWaitlistStandingSentence", () => {
    it("counts the viewer as part of the list", () => {
      expect(yourWaitlistStandingSentence(1)).toBe(
        "You're the only person on the waitlist."
      );
      expect(yourWaitlistStandingSentence(5)).toBe(
        "You're one of 5 people on the waitlist."
      );
    });

    it("never claims a queue position", () => {
      expect(yourWaitlistStandingSentence(5)).not.toMatch(/\b(1st|2nd|3rd|\d+th|position|next in line)\b/);
      expect(WAITLIST_EXPLAINER).not.toMatch(/\b(position|order|next in line)\b/);
    });
  });
});
