import { describe, it, expect } from "vitest";
import {
  aggregateShortageLogs,
  parseMonthsParam,
  percentage,
  sitesForLog,
  signupKey,
  UNKNOWN_SITE,
  type ShortageLogRow,
  type SignupIndex,
} from "./shortage-analytics";

/** Build a log row, defaulting the fields a test doesn't care about. */
function log(overrides: Partial<ShortageLogRow>): ShortageLogRow {
  return {
    sentAt: new Date("2026-01-10T02:00:00.000Z"),
    sentBy: "admin-1",
    recipientId: "vol-1",
    success: true,
    shifts: [{ shiftLocation: "Wellington" }],
    ...overrides,
  };
}

describe("percentage", () => {
  it("rounds to a whole percentage", () => {
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(2, 3)).toBe(67);
    expect(percentage(3, 4)).toBe(75);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(5, 0)).toBe(0);
  });
});

describe("parseMonthsParam", () => {
  it("returns 0 for all-time", () => {
    expect(parseMonthsParam("all")).toBe(0);
  });

  it("accepts positive integers", () => {
    expect(parseMonthsParam("3")).toBe(3);
    expect(parseMonthsParam("12")).toBe(12);
  });

  it("falls back to 12 for missing, invalid, or non-positive values", () => {
    expect(parseMonthsParam(null)).toBe(12);
    expect(parseMonthsParam(undefined)).toBe(12);
    expect(parseMonthsParam("")).toBe(12);
    expect(parseMonthsParam("abc")).toBe(12);
    expect(parseMonthsParam("-3")).toBe(12);
    expect(parseMonthsParam("0")).toBe(12);
  });
});

describe("sitesForLog", () => {
  it("returns the distinct locations from the shifts JSON", () => {
    const sites = sitesForLog(
      log({
        shifts: [
          { shiftLocation: "Wellington" },
          { shiftLocation: "Glen Innes" },
          { shiftLocation: "Wellington" },
        ],
      })
    );
    expect(sites.sort()).toEqual(["Glen Innes", "Wellington"]);
  });

  it("falls back to Unknown for blank, missing, or empty shifts", () => {
    expect(sitesForLog(log({ shifts: [{ shiftLocation: "" }] }))).toEqual([
      UNKNOWN_SITE,
    ]);
    expect(sitesForLog(log({ shifts: [{}] }))).toEqual([UNKNOWN_SITE]);
    expect(sitesForLog(log({ shifts: [] }))).toEqual([UNKNOWN_SITE]);
    expect(sitesForLog(log({ shifts: null }))).toEqual([UNKNOWN_SITE]);
  });
});

describe("aggregateShortageLogs — totals", () => {
  it("is empty for no logs", () => {
    const { totals, bySite, trend } = aggregateShortageLogs([]);
    expect(totals).toEqual({
      sendEvents: 0,
      emails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      volunteersReached: 0,
      successRate: 0,
      converted: 0,
      conversionRate: 0,
    });
    expect(bySite).toEqual([]);
    expect(trend).toEqual([]);
  });

  it("counts one send event per (sentAt, sentBy) batch and one email per row", () => {
    const sentAt = new Date("2026-01-10T02:00:00.000Z");
    const { totals } = aggregateShortageLogs([
      // One batch → three recipients.
      log({ sentAt, sentBy: "admin-1", recipientId: "vol-1" }),
      log({ sentAt, sentBy: "admin-1", recipientId: "vol-2" }),
      log({ sentAt, sentBy: "admin-1", recipientId: "vol-3" }),
      // A separate send by a different admin at a different time.
      log({
        sentAt: new Date("2026-01-12T03:00:00.000Z"),
        sentBy: "admin-2",
        recipientId: "vol-1",
      }),
    ]);

    expect(totals.sendEvents).toBe(2);
    expect(totals.emails).toBe(4);
    // vol-1 appears in both batches but is one distinct volunteer.
    expect(totals.volunteersReached).toBe(3);
  });

  it("tracks delivery success and failure and the success rate", () => {
    const sentAt = new Date("2026-02-01T02:00:00.000Z");
    const { totals } = aggregateShortageLogs([
      log({ sentAt, recipientId: "vol-1", success: true }),
      log({ sentAt, recipientId: "vol-2", success: true }),
      log({ sentAt, recipientId: "vol-3", success: true }),
      log({ sentAt, recipientId: "vol-4", success: false }),
    ]);
    expect(totals.successfulEmails).toBe(3);
    expect(totals.failedEmails).toBe(1);
    expect(totals.successRate).toBe(75);
  });
});

describe("aggregateShortageLogs — per site", () => {
  it("counts a multi-site send toward each site but once org-wide", () => {
    const { totals, bySite } = aggregateShortageLogs([
      log({
        recipientId: "vol-1",
        shifts: [{ shiftLocation: "Wellington" }, { shiftLocation: "Glen Innes" }],
      }),
    ]);

    // Org-wide: a single send event and a single email.
    expect(totals.sendEvents).toBe(1);
    expect(totals.emails).toBe(1);

    // Per site: the send counts toward both restaurants.
    const wellington = bySite.find((s) => s.location === "Wellington");
    const glenInnes = bySite.find((s) => s.location === "Glen Innes");
    expect(wellington?.sendEvents).toBe(1);
    expect(wellington?.emails).toBe(1);
    expect(glenInnes?.sendEvents).toBe(1);
    expect(glenInnes?.emails).toBe(1);
  });

  it("sorts sites by email volume descending", () => {
    const sentAt = new Date("2026-03-01T02:00:00.000Z");
    const { bySite } = aggregateShortageLogs([
      log({ sentAt, recipientId: "w1", shifts: [{ shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "w2", shifts: [{ shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "g1", shifts: [{ shiftLocation: "Glen Innes" }] }),
    ]);
    expect(bySite.map((s) => s.location)).toEqual(["Wellington", "Glen Innes"]);
    expect(bySite[0].emails).toBe(2);
    expect(bySite[1].emails).toBe(1);
  });

  it("keeps only the requested site when filtered", () => {
    const { totals, bySite } = aggregateShortageLogs(
      [
        log({ recipientId: "w1", shifts: [{ shiftLocation: "Wellington" }] }),
        log({
          recipientId: "g1",
          shifts: [{ shiftLocation: "Glen Innes" }],
        }),
        log({
          recipientId: "wg1",
          shifts: [
            { shiftLocation: "Wellington" },
            { shiftLocation: "Glen Innes" },
          ],
        }),
      ],
      "Wellington"
    );

    // Only rows that covered Wellington count: the Wellington-only row and the
    // multi-site row (not the Glen-Innes-only row).
    expect(totals.emails).toBe(2);
    expect(bySite).toHaveLength(1);
    expect(bySite[0].location).toBe("Wellington");
    expect(bySite[0].emails).toBe(2);
  });
});

describe("aggregateShortageLogs — monthly trend", () => {
  it("buckets sends by NZ month, ordered chronologically", () => {
    const { trend } = aggregateShortageLogs([
      // 2026-02-01 13:00 UTC is still 2026-02-02 in NZ (UTC+13).
      log({
        sentAt: new Date("2026-02-01T13:00:00.000Z"),
        sentBy: "admin-1",
        recipientId: "a",
      }),
      log({
        sentAt: new Date("2026-01-10T02:00:00.000Z"),
        sentBy: "admin-1",
        recipientId: "b",
      }),
      log({
        sentAt: new Date("2026-01-10T02:00:00.000Z"),
        sentBy: "admin-1",
        recipientId: "c",
      }),
    ]);

    expect(trend.map((t) => t.month)).toEqual(["2026-01", "2026-02"]);
    const january = trend.find((t) => t.month === "2026-01");
    expect(january?.sendEvents).toBe(1);
    expect(january?.emails).toBe(2);
  });

  it("splits delivered alerts per location aligned to the trend months", () => {
    const jan = new Date("2026-01-10T02:00:00.000Z");
    const feb = new Date("2026-02-10T02:00:00.000Z");
    const { trend, trendByLocation } = aggregateShortageLogs([
      log({
        sentAt: jan,
        recipientId: "a",
        shifts: [{ shiftId: "s1", shiftLocation: "Wellington" }],
      }),
      log({
        sentAt: jan,
        recipientId: "b",
        shifts: [{ shiftId: "s2", shiftLocation: "Glen Innes" }],
      }),
      log({
        sentAt: feb,
        recipientId: "c",
        shifts: [{ shiftId: "s3", shiftLocation: "Wellington" }],
      }),
      // A failed alert must not contribute to the stacked delivered series.
      log({
        sentAt: feb,
        recipientId: "d",
        success: false,
        shifts: [{ shiftId: "s4", shiftLocation: "Glen Innes" }],
      }),
    ]);

    expect(trend.map((t) => t.month)).toEqual(["2026-01", "2026-02"]);
    const wellington = trendByLocation.find((l) => l.location === "Wellington");
    const glenInnes = trendByLocation.find((l) => l.location === "Glen Innes");
    expect(wellington?.delivered).toEqual([1, 1]);
    expect(glenInnes?.delivered).toEqual([1, 0]);
  });
});

describe("aggregateShortageLogs — conversions (effectiveness)", () => {
  const sentAt = new Date("2026-01-10T02:00:00.000Z");

  function index(entries: Array<[string, string, Date]>): SignupIndex {
    return new Map(entries.map(([u, s, at]) => [signupKey(u, s), at]));
  }

  it("counts a recipient who signed up after the alert as converted", () => {
    const logs = [
      log({
        sentAt,
        recipientId: "vol-1",
        shifts: [{ shiftId: "shift-a", shiftLocation: "Wellington" }],
      }),
    ];
    const signups = index([
      ["vol-1", "shift-a", new Date("2026-01-10T09:00:00.000Z")], // after
    ]);

    const { totals, bySite } = aggregateShortageLogs(logs, null, signups);
    expect(totals.converted).toBe(1);
    expect(totals.conversionRate).toBe(100);
    expect(bySite[0].converted).toBe(1);
    expect(bySite[0].conversionRate).toBe(100);
  });

  it("does not count a signup made before the alert", () => {
    const logs = [
      log({
        sentAt,
        recipientId: "vol-1",
        shifts: [{ shiftId: "shift-a", shiftLocation: "Wellington" }],
      }),
    ];
    const signups = index([
      ["vol-1", "shift-a", new Date("2026-01-09T09:00:00.000Z")], // before
    ]);

    const { totals } = aggregateShortageLogs(logs, null, signups);
    expect(totals.converted).toBe(0);
    expect(totals.conversionRate).toBe(0);
  });

  it("does not credit a failed (undelivered) alert even if they signed up", () => {
    const logs = [
      log({
        sentAt,
        recipientId: "vol-1",
        success: false,
        shifts: [{ shiftId: "shift-a", shiftLocation: "Wellington" }],
      }),
    ];
    const signups = index([
      ["vol-1", "shift-a", new Date("2026-01-10T09:00:00.000Z")], // after
    ]);

    const { totals } = aggregateShortageLogs(logs, null, signups);
    expect(totals.successfulEmails).toBe(0);
    expect(totals.converted).toBe(0);
    expect(totals.conversionRate).toBe(0);
  });

  it("uses delivered alerts as the conversion-rate denominator", () => {
    const logs = [
      log({ sentAt, recipientId: "vol-1", success: true, shifts: [{ shiftId: "s", shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "vol-2", success: true, shifts: [{ shiftId: "s", shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "vol-3", success: true, shifts: [{ shiftId: "s", shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "vol-4", success: true, shifts: [{ shiftId: "s", shiftLocation: "Wellington" }] }),
    ];
    // Only vol-1 signs up afterwards → 1 of 4 delivered = 25%.
    const signups = index([
      ["vol-1", "s", new Date("2026-01-11T09:00:00.000Z")],
    ]);

    const { totals } = aggregateShortageLogs(logs, null, signups);
    expect(totals.converted).toBe(1);
    expect(totals.conversionRate).toBe(25);
  });

  it("credits the conversion to the site of the shift the recipient signed up for", () => {
    // One alert covering shifts at two restaurants; recipient signs up for the
    // Glen Innes shift only.
    const logs = [
      log({
        sentAt,
        recipientId: "vol-1",
        shifts: [
          { shiftId: "wel-1", shiftLocation: "Wellington" },
          { shiftId: "gi-1", shiftLocation: "Glen Innes" },
        ],
      }),
    ];
    const signups = index([
      ["vol-1", "gi-1", new Date("2026-01-10T09:00:00.000Z")],
    ]);

    const { totals, bySite } = aggregateShortageLogs(logs, null, signups);
    expect(totals.converted).toBe(1);
    const wellington = bySite.find((s) => s.location === "Wellington");
    const glenInnes = bySite.find((s) => s.location === "Glen Innes");
    expect(glenInnes?.converted).toBe(1);
    expect(wellington?.converted).toBe(0);
  });

  it("reports per-month signups on the trend", () => {
    const logs = [
      log({ sentAt, recipientId: "vol-1", shifts: [{ shiftId: "s1", shiftLocation: "Wellington" }] }),
      log({ sentAt, recipientId: "vol-2", shifts: [{ shiftId: "s1", shiftLocation: "Wellington" }] }),
    ];
    const signups = index([
      ["vol-1", "s1", new Date("2026-01-12T09:00:00.000Z")],
    ]);

    const { trend } = aggregateShortageLogs(logs, null, signups);
    const january = trend.find((t) => t.month === "2026-01");
    expect(january?.deliveredEmails).toBe(2);
    expect(january?.signups).toBe(1);
  });
});
