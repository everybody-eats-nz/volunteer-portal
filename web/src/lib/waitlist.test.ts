import { describe, it, expect } from "vitest";

import {
  offerDeadlineLabel,
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

describe("offerDeadlineLabel", () => {
  // Fixed NZ instants. 2026-09-23 is a Wednesday; NZST is UTC+12.
  const wedMidday = new Date("2026-09-23T00:00:00.000Z"); // 12:00PM Wed NZ

  it("says 'today' for the common case - offers run at most four hours", () => {
    const expires = new Date("2026-09-23T03:34:00.000Z"); // 3:34PM Wed NZ
    expect(offerDeadlineLabel(expires, wedMidday)).toBe("3:34PM today");
  });

  it("says 'tomorrow' when the window crosses midnight", () => {
    const lateWed = new Date("2026-09-23T10:00:00.000Z"); // 10:00PM Wed NZ
    const expires = new Date("2026-09-23T13:30:00.000Z"); // 1:30AM Thu NZ
    expect(offerDeadlineLabel(expires, lateWed)).toBe("1:30AM tomorrow");
  });

  it("names the day only when it is further out than tomorrow", () => {
    const expires = new Date("2026-09-25T05:30:00.000Z"); // 5:30PM Fri NZ
    expect(offerDeadlineLabel(expires, wedMidday)).toBe("5:30PM on Friday");
  });

  it("compares days in NZ time, not the reader's", () => {
    // 11:00PM Wed NZ is still Wednesday *morning* in UTC. A naive UTC or
    // device-local comparison would call this one "tomorrow".
    const expires = new Date("2026-09-23T11:00:00.000Z"); // 11:00PM Wed NZ
    expect(offerDeadlineLabel(expires, wedMidday)).toBe("11:00PM today");
  });
});
