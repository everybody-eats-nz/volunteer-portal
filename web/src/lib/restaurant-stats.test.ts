import { describe, it, expect } from "vitest";
import {
  computeNonPayingRatio,
  computeTotalDonations,
  computePerHead,
  computePerPaying,
  computeNightDerived,
} from "./restaurant-stats";

describe("restaurant-stats", () => {
  describe("computeNonPayingRatio", () => {
    it("divides non-paying count by customers", () => {
      // Sheet 20/1: 48 non-paying of 122 customers → 0.393
      expect(computeNonPayingRatio(48, 122)).toBeCloseTo(0.3934, 3);
    });

    it("returns null when an input is missing or customers is zero", () => {
      expect(computeNonPayingRatio(48, null)).toBeNull();
      expect(computeNonPayingRatio(null, 122)).toBeNull();
      expect(computeNonPayingRatio(48, 0)).toBeNull();
    });
  });

  describe("computeTotalDonations", () => {
    it("sums the three koha streams", () => {
      // Sheet 20/1: cash 48, eftpos 307.19, quest/stripe 393 → 748.19
      expect(computeTotalDonations(48, 307.19, 393)).toBeCloseTo(748.19, 2);
    });

    it("treats missing streams as zero when at least one is present", () => {
      expect(computeTotalDonations(50, null, undefined)).toBe(50);
    });

    it("returns null when all streams are missing", () => {
      expect(computeTotalDonations(null, null, null)).toBeNull();
    });
  });

  describe("computePerHead", () => {
    it("divides total by customers", () => {
      expect(computePerHead(748.19, 122)).toBeCloseTo(6.1327, 3);
    });

    it("returns null on zero or missing customers", () => {
      expect(computePerHead(748.19, 0)).toBeNull();
      expect(computePerHead(748.19, null)).toBeNull();
      expect(computePerHead(null, 122)).toBeNull();
    });
  });

  describe("computePerPaying", () => {
    it("divides total by paying customers (customers − non-paying)", () => {
      // 748.19 / (122 − 48) = 10.1107
      expect(computePerPaying(748.19, 122, 48)).toBeCloseTo(10.1107, 3);
    });

    it("treats a missing non-paying count as zero", () => {
      expect(computePerPaying(100, 50, null)).toBeCloseTo(2, 5);
    });

    it("returns null when no paying customers remain", () => {
      expect(computePerPaying(100, 10, 10)).toBeNull();
      expect(computePerPaying(100, 10, 20)).toBeNull();
    });
  });

  describe("computeNightDerived", () => {
    it("computes the full set for a real service night", () => {
      const d = computeNightDerived({
        customers: 122,
        nonPayingCount: 48,
        cash: 48,
        eftpos: 307.19,
        stripe: 393,
      });
      expect(d.nonPayingRatio).toBeCloseTo(0.3934, 3);
      expect(d.totalDonations).toBeCloseTo(748.19, 2);
      expect(d.perHead).toBeCloseTo(6.1327, 3);
      expect(d.perPaying).toBeCloseTo(10.1107, 3);
    });

    it("returns nulls when nothing is entered", () => {
      const d = computeNightDerived({});
      expect(d).toEqual({
        nonPayingRatio: null,
        totalDonations: null,
        perHead: null,
        perPaying: null,
      });
    });
  });
});
