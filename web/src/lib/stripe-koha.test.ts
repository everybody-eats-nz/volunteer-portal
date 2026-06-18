import { describe, it, expect } from "vitest";
import {
  matchesLocation,
  centsToDollars,
  sumNightKoha,
  type KohaSession,
  type KohaPaymentIntent,
} from "./stripe-koha";

describe("stripe-koha", () => {
  describe("matchesLocation", () => {
    it("matches an en-dash donation product name", () => {
      expect(
        matchesLocation(
          "You're supporting Everybody Eats – Wellington",
          "Wellington"
        )
      ).toBe(true);
    });

    it("matches an em-dash pay-at-table description", () => {
      expect(matchesLocation("Everybody Eats — Glen Innes", "Glen Innes")).toBe(
        true
      );
    });

    it("is case- and whitespace-insensitive", () => {
      expect(
        matchesLocation("EVERYBODY   EATS —   onehunga", "Onehunga")
      ).toBe(true);
    });

    it("excludes the Special events product from real locations", () => {
      const name = "You're supporting Everybody Eats - Special events";
      expect(matchesLocation(name, "Wellington")).toBe(false);
      expect(matchesLocation(name, "Glen Innes")).toBe(false);
      expect(matchesLocation(name, "Onehunga")).toBe(false);
    });

    it("does not match a different location", () => {
      expect(
        matchesLocation("Everybody Eats — Wellington", "Onehunga")
      ).toBe(false);
    });

    it("returns false for empty text or location", () => {
      expect(matchesLocation(null, "Wellington")).toBe(false);
      expect(matchesLocation(undefined, "Wellington")).toBe(false);
      expect(matchesLocation("Everybody Eats — Wellington", "")).toBe(false);
    });
  });

  describe("centsToDollars", () => {
    it("converts minor units to dollars", () => {
      expect(centsToDollars(74819)).toBe(748.19);
      expect(centsToDollars(0)).toBe(0);
      expect(centsToDollars(500)).toBe(5);
    });
  });

  describe("sumNightKoha", () => {
    const session = (over: Partial<KohaSession>): KohaSession => ({
      id: "cs_1",
      amountTotal: 1000,
      currency: "nzd",
      paymentIntentId: null,
      productNames: ["You're supporting Everybody Eats – Wellington"],
      ...over,
    });
    const intent = (over: Partial<KohaPaymentIntent>): KohaPaymentIntent => ({
      id: "pi_1",
      amountReceived: 1000,
      currency: "nzd",
      description: "Everybody Eats — Wellington",
      ...over,
    });

    it("sums donation sessions for the location", () => {
      const result = sumNightKoha(
        {
          sessions: [
            session({ id: "cs_1", amountTotal: 2500 }),
            session({ id: "cs_2", amountTotal: 1500 }),
          ],
          paymentIntents: [],
        },
        "Wellington"
      );
      expect(result.totalCents).toBe(4000);
      expect(result.total).toBe(40);
      expect(result.paymentCount).toBe(2);
    });

    it("adds standalone pay-at-table PaymentIntents", () => {
      const result = sumNightKoha(
        {
          sessions: [session({ amountTotal: 2000 })],
          paymentIntents: [intent({ id: "pi_pat", amountReceived: 3000 })],
        },
        "Wellington"
      );
      expect(result.totalCents).toBe(5000);
      expect(result.paymentCount).toBe(2);
    });

    it("dedupes a PaymentIntent already counted via its Checkout Session", () => {
      const result = sumNightKoha(
        {
          sessions: [
            session({ amountTotal: 2000, paymentIntentId: "pi_donation" }),
          ],
          // Same PI shows up in the PI list — must not be double counted.
          paymentIntents: [intent({ id: "pi_donation", amountReceived: 2000 })],
        },
        "Wellington"
      );
      expect(result.totalCents).toBe(2000);
      expect(result.paymentCount).toBe(1);
    });

    it("splits payments across locations", () => {
      const input = {
        sessions: [
          session({
            id: "cs_w",
            amountTotal: 1000,
            productNames: ["Everybody Eats – Wellington"],
          }),
          session({
            id: "cs_o",
            amountTotal: 5000,
            productNames: ["Everybody Eats – Onehunga"],
          }),
        ],
        paymentIntents: [
          intent({
            id: "pi_gi",
            amountReceived: 700,
            description: "Everybody Eats — Glen Innes",
          }),
        ],
      };
      expect(sumNightKoha(input, "Wellington").totalCents).toBe(1000);
      expect(sumNightKoha(input, "Onehunga").totalCents).toBe(5000);
      expect(sumNightKoha(input, "Glen Innes").totalCents).toBe(700);
    });

    it("ignores non-NZD payments", () => {
      const result = sumNightKoha(
        {
          sessions: [session({ amountTotal: 9999, currency: "usd" })],
          paymentIntents: [
            intent({ id: "pi_usd", amountReceived: 9999, currency: "usd" }),
          ],
        },
        "Wellington"
      );
      expect(result.totalCents).toBe(0);
      expect(result.paymentCount).toBe(0);
    });

    it("skips sessions with no amount and unmatched products", () => {
      const result = sumNightKoha(
        {
          sessions: [
            session({ id: "cs_null", amountTotal: null }),
            session({
              id: "cs_other",
              amountTotal: 1000,
              productNames: ["Everybody Eats - Special events"],
            }),
          ],
          paymentIntents: [],
        },
        "Wellington"
      );
      expect(result.totalCents).toBe(0);
      expect(result.paymentCount).toBe(0);
    });
  });
});
