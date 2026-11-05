import { describe, expect, it } from "vitest";
import {
  classifyApplication,
  formatResponseHours,
  summariseApplications,
  summariseByLocation,
  type ApplicationRecord,
} from "./application-responses";

const NOW = new Date("2026-11-06T12:00:00Z");
const H = 60 * 60 * 1000;

function app(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    appliedAt: new Date(NOW.getTime() - 100 * H),
    respondedAt: null,
    response: null,
    status: "PENDING",
    location: "Wellington",
    shiftStart: new Date(NOW.getTime() + 72 * H),
    ...overrides,
  };
}

function answered(afterHours: number, response: ApplicationRecord["response"] = "APPROVED") {
  const appliedAt = new Date(NOW.getTime() - 200 * H);
  return app({
    appliedAt,
    respondedAt: new Date(appliedAt.getTime() + afterHours * H),
    response,
    status: response === "DECLINED" ? "CANCELED" : "CONFIRMED",
  });
}

describe("classifyApplication", () => {
  it("measures the team's response time", () => {
    expect(classifyApplication(answered(30), NOW)).toEqual({
      kind: "answered",
      hours: 30,
      response: "APPROVED",
    });
  });

  it("keeps auto-approvals apart from the team's answers", () => {
    expect(
      classifyApplication(app({ response: "AUTO_APPROVED", respondedAt: NOW, status: "CONFIRMED" }), NOW)
    ).toEqual({ kind: "auto" });
  });

  it("treats a pending application whose shift has passed as missed", () => {
    expect(
      classifyApplication(app({ shiftStart: new Date(NOW.getTime() - H) }), NOW)
    ).toEqual({ kind: "missed" });
  });

  it("calls a closed application with no response on record closed", () => {
    expect(classifyApplication(app({ status: "CANCELED" }), NOW)).toEqual({
      kind: "closed",
    });
  });
});

describe("summariseApplications", () => {
  it("scores only applications that have come due against the 48 hours", () => {
    const stats = summariseApplications(
      [
        answered(5), // on time
        answered(48), // on time, right at the line
        answered(60, "DECLINED"), // late
        app({ appliedAt: new Date(NOW.getTime() - 50 * H) }), // overdue
        app({ appliedAt: new Date(NOW.getTime() - 3 * H) }), // still in time
        app({ response: "AUTO_APPROVED", respondedAt: NOW, status: "CONFIRMED" }),
      ],
      NOW
    );

    expect(stats).toMatchObject({
      applications: 6,
      autoApproved: 1,
      answered: 3,
      answeredOnTime: 2,
      answeredLate: 1,
      declined: 1,
      waiting: 2,
      waitingOverdue: 1,
      // 2 on time out of 3 answered + 1 overdue
      onTimeRate: 50,
      medianResponseHours: 48,
      declineRate: 33,
    });
  });

  it("has no rates when nothing has come due", () => {
    const stats = summariseApplications([app({ appliedAt: NOW })], NOW);
    expect(stats.onTimeRate).toBeNull();
    expect(stats.medianResponseHours).toBeNull();
    expect(stats.declineRate).toBeNull();
  });
});

describe("summariseByLocation", () => {
  it("groups by restaurant, busiest first", () => {
    const rows = summariseByLocation(
      [
        answered(5),
        { ...answered(5, "DECLINED"), location: "Glen Innes" },
        { ...answered(70, "DECLINED"), location: "Glen Innes" },
      ],
      NOW
    );
    expect(rows.map((r) => [r.location, r.declined])).toEqual([
      ["Glen Innes", 2],
      ["Wellington", 0],
    ]);
  });
});

describe("formatResponseHours", () => {
  it("picks a readable unit", () => {
    expect(formatResponseHours(null)).toBe("-");
    expect(formatResponseHours(0.25)).toBe("15 min");
    expect(formatResponseHours(6.4)).toBe("6 h");
    expect(formatResponseHours(60)).toBe("2.5 days");
    expect(formatResponseHours(72)).toBe("3 days");
  });
});
