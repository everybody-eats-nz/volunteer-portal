import { describe, expect, it } from "vitest";

import {
  WAITLIST_EXPLAINER,
  waitlistChipLabel,
  waitlistSizeSentence,
  yourWaitlistStandingSentence,
} from "./waitlist";

describe("waitlist copy", () => {
  it("keeps chip labels compact", () => {
    expect(waitlistChipLabel(1)).toBe("1 waiting");
    expect(waitlistChipLabel(20)).toBe("20 waiting");
  });

  it("pluralises the size sentence", () => {
    expect(waitlistSizeSentence(0)).toBe("No one is on the waitlist yet.");
    expect(waitlistSizeSentence(1)).toBe("1 volunteer is on the waitlist.");
    expect(waitlistSizeSentence(9)).toBe("9 volunteers are on the waitlist.");
  });

  it("counts the viewer as part of the list", () => {
    expect(yourWaitlistStandingSentence(1)).toBe(
      "You're the only person on the waitlist."
    );
    expect(yourWaitlistStandingSentence(4)).toBe(
      "You're one of 4 people on the waitlist."
    );
  });

  it("never promises a queue position", () => {
    expect(WAITLIST_EXPLAINER).not.toMatch(/position|order|next in line/i);
  });
});
