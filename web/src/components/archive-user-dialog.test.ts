import { describe, it, expect } from "vitest";
import { describeImpact } from "./archive-user-dialog";

/**
 * describeImpact builds the sentence the archive dialog uses to warn an admin
 * about what a volunteer is still booked on, so its pluralisation and list
 * joining are what an admin actually reads.
 */
describe("describeImpact", () => {
  it("returns null when the volunteer has nothing outstanding", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 0,
        upcomingPending: 0,
        activeRegulars: 0,
      })
    ).toBeNull();
  });

  it("uses the singular form for a count of one", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 1,
        upcomingPending: 0,
        activeRegulars: 0,
      })
    ).toBe("1 confirmed shift");
  });

  it("pluralises counts above one", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 3,
        upcomingPending: 0,
        activeRegulars: 0,
      })
    ).toBe("3 confirmed shifts");
  });

  it("joins two parts with 'and', without a comma", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 2,
        upcomingPending: 0,
        activeRegulars: 1,
      })
    ).toBe("2 confirmed shifts and 1 active regular slot");
  });

  it("comma-separates three parts and joins the last with 'and'", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 2,
        upcomingPending: 3,
        activeRegulars: 1,
      })
    ).toBe(
      "2 confirmed shifts, 3 pending signups and 1 active regular slot"
    );
  });

  it("omits categories with a zero count", () => {
    expect(
      describeImpact({
        upcomingConfirmed: 0,
        upcomingPending: 4,
        activeRegulars: 0,
      })
    ).toBe("4 pending signups");
  });
});
