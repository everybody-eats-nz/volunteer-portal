import { describe, expect, it } from "vitest";

import {
  friendsLine,
  mergeVolunteers,
  periodVolunteersLabel,
  splitBySignupStatus,
  type ShiftVolunteer,
} from "./shift-friends";

const volunteer = (
  name: string,
  status: ShiftVolunteer["status"] = "CONFIRMED"
): ShiftVolunteer => ({ id: name.toLowerCase(), name, status });

describe("splitBySignupStatus", () => {
  it("counts only confirmed signups as going", () => {
    const { going, waiting } = splitBySignupStatus([
      volunteer("Ana Wiremu"),
      volunteer("Bo Tane", "PENDING"),
    ]);
    expect(going.map((v) => v.name)).toEqual(["Ana Wiremu"]);
    expect(waiting.map((v) => v.name)).toEqual(["Bo Tane"]);
  });

  it("leaves waitlisted volunteers out of both groups", () => {
    const { going, waiting } = splitBySignupStatus([
      volunteer("Cass", "WAITLISTED"),
    ]);
    expect(going).toEqual([]);
    expect(waiting).toEqual([]);
  });
});

describe("mergeVolunteers", () => {
  it("keeps a confirmed spot when the same person is pending on another role", () => {
    const merged = mergeVolunteers([
      [volunteer("Ana")],
      [{ ...volunteer("Ana"), status: "PENDING" as const }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("CONFIRMED");
  });

  it("upgrades a pending volunteer once a confirmed signup shows up", () => {
    const merged = mergeVolunteers([
      [{ ...volunteer("Ana"), status: "PENDING" as const }],
      [volunteer("Ana")],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("CONFIRMED");
  });

  it("dedupes across roles without dropping distinct people", () => {
    const merged = mergeVolunteers([
      [volunteer("Ana"), volunteer("Bo")],
      [volunteer("Ana"), volunteer("Cass")],
    ]);
    expect(merged.map((v) => v.name)).toEqual(["Ana", "Bo", "Cass"]);
  });
});

describe("friendsLine", () => {
  const [ana, bo, cass] = [volunteer("Ana Wiremu"), volunteer("Bo"), volunteer("Cass")];

  it("names confirmed volunteers as going", () => {
    expect(friendsLine([ana], [], false)).toBe("Ana is signed up");
    expect(friendsLine([ana, bo], [], false)).toBe("Ana & Bo are going");
    expect(friendsLine([ana, bo, cass], [], false)).toBe("Ana + 2 others going");
  });

  it("switches to 'With' phrasing when the viewer is on the shift too", () => {
    expect(friendsLine([ana], [], true)).toBe("With Ana");
    expect(friendsLine([ana, bo], [], true)).toBe("With Ana & Bo");
    expect(friendsLine([ana, bo, cass], [], true)).toBe("With Ana + 2 more");
  });

  it("never claims a pending volunteer is going", () => {
    const pending = [
      { ...ana, status: "PENDING" as const },
      { ...bo, status: "PENDING" as const },
      { ...cass, status: "PENDING" as const },
    ];
    expect(friendsLine([], pending.slice(0, 1), false)).toBe(
      "Ana is waiting on approval"
    );
    expect(friendsLine([], pending.slice(0, 2), false)).toBe(
      "Ana & Bo are waiting on approval"
    );
    expect(friendsLine([], pending, false)).toBe(
      "Ana + 2 others waiting on approval"
    );
  });

  it("keeps the wait wording even when the viewer holds the shift", () => {
    expect(friendsLine([], [{ ...ana, status: "PENDING" }], true)).toBe(
      "Ana is waiting on approval"
    );
  });

  it("leads with the confirmed volunteers on a mixed shift", () => {
    expect(friendsLine([ana], [{ ...bo, status: "PENDING" }], false)).toBe(
      "Ana is signed up"
    );
  });

  it("is empty when nobody is on the shift", () => {
    expect(friendsLine([], [], false)).toBe("");
  });
});

describe("periodVolunteersLabel", () => {
  const confirmed = [volunteer("Ana"), volunteer("Bo")];
  const pending = [{ ...volunteer("Cass"), status: "PENDING" as const }];

  it("counts confirmed volunteers only", () => {
    expect(periodVolunteersLabel(confirmed, [])).toBe("2 volunteers");
    expect(periodVolunteersLabel(confirmed.slice(0, 1), [])).toBe("1 volunteer");
  });

  it("keeps the approval queue out of the volunteer count", () => {
    expect(periodVolunteersLabel(confirmed, pending)).toBe(
      "2 volunteers · 1 waiting"
    );
  });

  it("spells out the wait when nobody is confirmed yet", () => {
    expect(periodVolunteersLabel([], pending)).toBe("1 waiting on approval");
  });

  it("is empty when nobody is on the session", () => {
    expect(periodVolunteersLabel([], [])).toBe("");
  });
});
