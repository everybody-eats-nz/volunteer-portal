import { describe, it, expect } from "vitest";
import {
  detectExceptions,
  type ExceptionTrip,
  type ExceptionVehicle,
} from "./exceptions";

const VAN: ExceptionVehicle = { id: "veh_kai", name: "Kai Van" };
const NOW = new Date("2026-09-07T18:00:00Z");

let counter = 0;
function trip(overrides: Partial<ExceptionTrip> = {}): ExceptionTrip {
  counter += 1;
  const startedAt = overrides.startedAt ?? new Date("2026-09-07T09:00:00Z");
  return {
    id: `trp_${counter}`,
    vehicleId: VAN.id,
    driverId: "usr_a",
    startedAt,
    endedAt: new Date(startedAt.getTime() + 90 * 60_000),
    startOdo: 100_000,
    endOdo: 100_020,
    startOdoPhotoUrl: "seed:odo",
    endOdoPhotoUrl: "seed:odo",
    distanceKm: 20,
    status: "CLOSED",
    endedByUserId: "usr_a",
    ...overrides,
  };
}

const kindsOf = (trips: ExceptionTrip[]) =>
  detectExceptions(trips, [VAN], NOW).map((e) => e.kind);

describe("detectExceptions", () => {
  it("finds nothing wrong with a clean chain", () => {
    const first = trip({ startOdo: 100_000, endOdo: 100_020, distanceKm: 20 });
    const second = trip({
      startOdo: 100_020,
      endOdo: 100_045,
      distanceKm: 25,
      startedAt: new Date("2026-09-07T13:00:00Z"),
    });
    expect(detectExceptions([first, second], [VAN], NOW)).toEqual([]);
  });

  it("catches driving that was never logged", () => {
    const first = trip({ startOdo: 100_000, endOdo: 100_020, distanceKm: 20 });
    const second = trip({
      startOdo: 100_057,
      endOdo: 100_070,
      distanceKm: 13,
      startedAt: new Date("2026-09-07T13:00:00Z"),
    });
    const found = detectExceptions([first, second], [VAN], NOW);
    const gap = found.find((e) => e.kind === "odo-gap");
    expect(gap).toBeDefined();
    expect(gap!.severity).toBe("high");
    expect(gap!.title).toContain("37 km");
    expect(gap!.relatedTripId).toBe(first.id);
  });

  it("treats a small gap as worth a look rather than urgent", () => {
    const first = trip({ startOdo: 100_000, endOdo: 100_020, distanceKm: 20 });
    const second = trip({
      startOdo: 100_025,
      endOdo: 100_040,
      distanceKm: 15,
      startedAt: new Date("2026-09-07T13:00:00Z"),
    });
    const gap = detectExceptions([first, second], [VAN], NOW).find(
      (e) => e.kind === "odo-gap"
    );
    expect(gap!.severity).toBe("medium");
  });

  it("catches a reading that goes backwards", () => {
    const first = trip({ startOdo: 100_000, endOdo: 100_512, distanceKm: 512 });
    const second = trip({
      startOdo: 100_030,
      endOdo: 100_050,
      distanceKm: 20,
      startedAt: new Date("2026-09-07T13:00:00Z"),
    });
    expect(kindsOf([first, second])).toContain("odo-overlap");
  });

  it("catches a missing start photo", () => {
    expect(kindsOf([trip({ startOdoPhotoUrl: null })])).toContain(
      "missing-photo"
    );
  });

  it("does not demand an end photo from a trip still open", () => {
    const open = trip({
      status: "OPEN",
      endedAt: null,
      endOdo: null,
      endOdoPhotoUrl: null,
      distanceKm: null,
      startedAt: new Date("2026-09-07T17:00:00Z"),
    });
    expect(kindsOf([open])).not.toContain("missing-photo");
  });

  it("catches an implausible distance using the shared rule", () => {
    const typo = trip({
      startOdo: 100_000,
      endOdo: 100_512,
      distanceKm: 512,
      endedAt: new Date("2026-09-07T11:00:00Z"),
    });
    expect(kindsOf([typo])).toContain("implausible-distance");
  });

  it("catches an end reading that is not above the start", () => {
    const zero = trip({ endOdo: 100_000, distanceKm: 0 });
    const found = detectExceptions([zero], [VAN], NOW);
    const bad = found.find((e) => e.kind === "implausible-distance");
    expect(bad!.severity).toBe("high");
    expect(bad!.detail).toContain("not above");
  });

  it("leaves a trip open today alone until it has been out too long", () => {
    const recent = trip({
      status: "OPEN",
      endedAt: null,
      endOdo: null,
      endOdoPhotoUrl: null,
      distanceKm: null,
      startedAt: new Date(NOW.getTime() - 2 * 3_600_000),
    });
    expect(kindsOf([recent])).not.toContain("left-open");
  });

  it("catches a trip left open for days", () => {
    const stranded = trip({
      status: "OPEN",
      endedAt: null,
      endOdo: null,
      endOdoPhotoUrl: null,
      distanceKm: null,
      startedAt: new Date(NOW.getTime() - 3 * 86_400_000),
    });
    const found = detectExceptions([stranded], [VAN], NOW);
    const open = found.find((e) => e.kind === "left-open");
    expect(open!.severity).toBe("high");
    expect(open!.title).toContain("3 days");
  });

  it("catches a trip closed by whoever took the van next", () => {
    const handover = trip({ endedByUserId: "usr_b", status: "FLAGGED" });
    expect(kindsOf([handover])).toContain("closed-by-next-driver");
  });

  it("does not flag a trip the driver ended themselves", () => {
    expect(kindsOf([trip({ endedByUserId: "usr_a" })])).not.toContain(
      "closed-by-next-driver"
    );
  });

  it("sorts the urgent ones first, newest first within a severity", () => {
    const backwardsFirst = trip({
      startOdo: 100_000,
      endOdo: 100_020,
      distanceKm: 20,
    });
    const noPhoto = trip({
      startOdo: 100_020,
      endOdo: 100_040,
      distanceKm: 20,
      startOdoPhotoUrl: null,
      startedAt: new Date("2026-09-07T13:00:00Z"),
    });
    const typo = trip({
      startOdo: 100_040,
      endOdo: 100_552,
      distanceKm: 512,
      startedAt: new Date("2026-09-07T15:00:00Z"),
      endedAt: new Date("2026-09-07T16:00:00Z"),
    });
    const found = detectExceptions([backwardsFirst, noPhoto, typo], [VAN], NOW);
    expect(found[0].severity).toBe("high");
    expect(found[found.length - 1].severity).toBe("medium");
  });

  it("is stable when re-run, because nothing is stored", () => {
    const trips = [trip({ startOdoPhotoUrl: null })];
    expect(detectExceptions(trips, [VAN], NOW)).toEqual(
      detectExceptions(trips, [VAN], NOW)
    );
  });

  it("fixing the underlying trip makes the exception disappear", () => {
    const broken = trip({ startOdoPhotoUrl: null });
    expect(kindsOf([broken])).toContain("missing-photo");
    expect(kindsOf([{ ...broken, startOdoPhotoUrl: "seed:odo" }])).not.toContain(
      "missing-photo"
    );
  });
});
