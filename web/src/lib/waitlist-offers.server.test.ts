import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  acceptWaitlistOffer,
  declineWaitlistOffer,
  expireLapsedOffers,
  hasLiveWaitlistOffer,
  offerWaitlistPlaces,
  WaitlistOfferError,
} from "./waitlist-offers.server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    shift: { findUnique: vi.fn() },
  },
}));

const autoApproval = vi.hoisted(() => ({
  getVolunteerSnapshots: vi.fn(),
  getLiveRules: vi.fn().mockResolvedValue([]),
  evaluateOutcome: vi.fn(),
  buildShiftContext: vi.fn().mockReturnValue({ shiftTypeId: "type-1" }),
}));
vi.mock("@/lib/auto-approval", () => autoApproval);

const notifyOffer = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/notifications", () => ({
  createWaitlistOfferNotification: notifyOffer,
}));
vi.mock("@/lib/timezone", () => ({
  formatInNZT: () => "Thursday, September 24",
}));

const findUnique = vi.mocked(prisma.signup.findUnique);
const findMany = vi.mocked(prisma.signup.findMany);
const count = vi.mocked(prisma.signup.count);
const update = vi.mocked(prisma.signup.update);
const updateMany = vi.mocked(prisma.signup.updateMany);
const shiftFindUnique = vi.mocked(prisma.shift.findUnique);

const HOUR = 60 * 60 * 1000;

function futureShift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    start: new Date(Date.now() + 48 * HOUR),
    capacity: 3,
    location: "Wellington",
    shiftTypeId: "type-1",
    shiftType: { name: "Kitchen Prep" },
    ...overrides,
  };
}

/**
 * `count` is called twice in offerWaitlistPlaces - confirmed, then live
 * offers - and the order matters to every capacity assertion here.
 */
function setCounts(confirmed: number, liveOffers: number) {
  count
    .mockResolvedValueOnce(confirmed as never)
    .mockResolvedValueOnce(liveOffers as never);
}

function waitlisted(ids: string[]) {
  return ids.map((id) => ({ id: `signup-${id}`, userId: `user-${id}` }));
}

function snapshotsFor(ids: string[]) {
  return ids.map((id) => ({ userId: `user-${id}` }));
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 0 } as never);
  update.mockResolvedValue({ id: "signup-a", status: "WAITLISTED" } as never);
  autoApproval.getLiveRules.mockResolvedValue([]);
  autoApproval.buildShiftContext.mockReturnValue({ shiftTypeId: "type-1" });
});

describe("offerWaitlistPlaces", () => {
  it("offers the freed place to the longest-waiting eligible volunteer", async () => {
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 0); // one place free
    findMany.mockResolvedValue(waitlisted(["a", "b"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(
      snapshotsFor(["a", "b"])
    );
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "APPROVED" });

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "signup-a" } })
    );
    // Oldest-first ordering is the promise the UI makes.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } })
    );
    expect(notifyOffer).toHaveBeenCalledTimes(1);
  });

  it("skips past anyone the auto-approval rules would not have approved", async () => {
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 0);
    findMany.mockResolvedValue(waitlisted(["a", "b"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(
      snapshotsFor(["a", "b"])
    );
    // First in line is held for a human; the place moves down the list.
    autoApproval.evaluateOutcome
      .mockReturnValueOnce({ outcome: "HELD" })
      .mockReturnValueOnce({ outcome: "APPROVED" });

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "signup-b" } })
    );
  });

  it("offers nothing when nobody waiting is eligible", async () => {
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 0);
    findMany.mockResolvedValue(waitlisted(["a"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(snapshotsFor(["a"]));
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "BLOCKED" });

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(notifyOffer).not.toHaveBeenCalled();
  });

  it("offers one place per free spot, never more", async () => {
    shiftFindUnique.mockResolvedValue(futureShift({ capacity: 5 }) as never);
    setCounts(3, 0); // two places free
    findMany.mockResolvedValue(waitlisted(["a", "b", "c", "d"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(
      snapshotsFor(["a", "b", "c", "d"])
    );
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "APPROVED" });

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("counts live offers against capacity so one place is never double-offered", async () => {
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 1); // one place free, already offered to someone
    findMany.mockResolvedValue(waitlisted(["b"]) as never);

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("does nothing for a shift that has already started", async () => {
    shiftFindUnique.mockResolvedValue(
      futureShift({ start: new Date(Date.now() - HOUR) }) as never
    );

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(0);
    expect(count).not.toHaveBeenCalled();
  });

  it("does not offer a place nobody could realistically answer in time", async () => {
    // Five minutes to go: the offer would expire before a push was read.
    shiftFindUnique.mockResolvedValue(
      futureShift({ start: new Date(Date.now() + 5 * 60 * 1000) }) as never
    );

    const result = await offerWaitlistPlaces("shift-1");

    expect(result.offered).toBe(0);
    expect(count).not.toHaveBeenCalled();
  });

  it("caps the offer window at the shift start", async () => {
    const start = new Date(Date.now() + HOUR);
    shiftFindUnique.mockResolvedValue(futureShift({ start }) as never);
    setCounts(2, 0);
    findMany.mockResolvedValue(waitlisted(["a"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(snapshotsFor(["a"]));
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "APPROVED" });

    await offerWaitlistPlaces("shift-1");

    const data = update.mock.calls[0][0].data as {
      waitlistOfferExpiresAt: Date;
    };
    expect(data.waitlistOfferExpiresAt.getTime()).toBe(start.getTime());
  });

  it("still reports the offer when the notification fails", async () => {
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 0);
    findMany.mockResolvedValue(waitlisted(["a"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(snapshotsFor(["a"]));
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "APPROVED" });
    notifyOffer.mockRejectedValueOnce(new Error("push is down"));

    const result = await offerWaitlistPlaces("shift-1");

    // The place is genuinely held for them; they'll see it in the app.
    expect(result.offered).toBe(1);
  });

  it("never throws into the caller - a cancellation must still succeed", async () => {
    shiftFindUnique.mockRejectedValue(new Error("database is on fire"));

    await expect(offerWaitlistPlaces("shift-1")).resolves.toEqual({
      offered: 0,
      expired: 0,
    });
  });
});

describe("expireLapsedOffers", () => {
  it("records a lapsed offer as declined so the place moves on", async () => {
    updateMany.mockResolvedValue({ count: 3 } as never);

    const expired = await expireLapsedOffers("shift-1");

    expect(expired).toBe(3);
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      shiftId: "shift-1",
      status: "WAITLISTED",
      waitlistOfferDeclinedAt: null,
    });
    expect(args.data).toMatchObject({
      waitlistOfferDeclinedAt: expect.any(Date),
    });
  });
});

describe("acceptWaitlistOffer", () => {
  const liveOffer = {
    id: "signup-a",
    userId: "user-a",
    shiftId: "shift-1",
    status: "WAITLISTED",
    waitlistOfferExpiresAt: new Date(Date.now() + HOUR),
    waitlistOfferDeclinedAt: null,
    shift: {
      id: "shift-1",
      start: new Date(Date.now() + 48 * HOUR),
      capacity: 3,
      shiftType: { name: "Kitchen Prep" },
    },
  };

  it("confirms the volunteer", async () => {
    findUnique.mockResolvedValue(liveOffer as never);
    count.mockResolvedValue(2 as never);
    update.mockResolvedValue({ id: "signup-a", status: "CONFIRMED" } as never);

    const { signup } = await acceptWaitlistOffer("signup-a", "user-a");

    expect(signup.status).toBe("CONFIRMED");
  });

  it("refuses an offer belonging to somebody else", async () => {
    findUnique.mockResolvedValue(liveOffer as never);

    await expect(
      acceptWaitlistOffer("signup-a", "user-someone-else")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses an offer whose window has closed", async () => {
    findUnique.mockResolvedValue({
      ...liveOffer,
      waitlistOfferExpiresAt: new Date(Date.now() - HOUR),
    } as never);

    await expect(
      acceptWaitlistOffer("signup-a", "user-a")
    ).rejects.toMatchObject({ status: 410 });
  });

  it("refuses a declined offer", async () => {
    findUnique.mockResolvedValue({
      ...liveOffer,
      waitlistOfferDeclinedAt: new Date(),
    } as never);

    await expect(
      acceptWaitlistOffer("signup-a", "user-a")
    ).rejects.toBeInstanceOf(WaitlistOfferError);
  });

  it("does not go over capacity when the place was filled meanwhile", async () => {
    findUnique.mockResolvedValue(liveOffer as never);
    count.mockResolvedValue(3 as never); // admin confirmed someone by hand

    await expect(
      acceptWaitlistOffer("signup-a", "user-a")
    ).rejects.toMatchObject({ status: 409 });
    // The stale offer is retired rather than left to be retried.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { waitlistOfferDeclinedAt: expect.any(Date) },
      })
    );
  });
});

describe("declineWaitlistOffer", () => {
  it("passes the place straight to the next person", async () => {
    findUnique.mockResolvedValue({
      id: "signup-a",
      userId: "user-a",
      shiftId: "shift-1",
      status: "WAITLISTED",
      waitlistOfferExpiresAt: new Date(Date.now() + HOUR),
      waitlistOfferDeclinedAt: null,
      shift: {
        id: "shift-1",
        start: new Date(Date.now() + 48 * HOUR),
        capacity: 3,
        shiftType: { name: "Kitchen Prep" },
      },
    } as never);
    shiftFindUnique.mockResolvedValue(futureShift() as never);
    setCounts(2, 0);
    findMany.mockResolvedValue(waitlisted(["b"]) as never);
    autoApproval.getVolunteerSnapshots.mockResolvedValue(snapshotsFor(["b"]));
    autoApproval.evaluateOutcome.mockReturnValue({ outcome: "APPROVED" });

    await declineWaitlistOffer("signup-a", "user-a");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "signup-b" } })
    );
  });
});

describe("hasLiveWaitlistOffer", () => {
  it.each([
    [
      "a live offer",
      {
        status: "WAITLISTED",
        waitlistOfferExpiresAt: new Date(Date.now() + HOUR),
        waitlistOfferDeclinedAt: null,
      },
      true,
    ],
    [
      "an expired offer",
      {
        status: "WAITLISTED",
        waitlistOfferExpiresAt: new Date(Date.now() - HOUR),
        waitlistOfferDeclinedAt: null,
      },
      false,
    ],
    [
      "a declined offer",
      {
        status: "WAITLISTED",
        waitlistOfferExpiresAt: new Date(Date.now() + HOUR),
        waitlistOfferDeclinedAt: new Date(),

      },
      false,
    ],
    [
      "an already-confirmed signup",
      {
        status: "CONFIRMED",
        waitlistOfferExpiresAt: new Date(Date.now() + HOUR),
        waitlistOfferDeclinedAt: null,
      },
      false,
    ],
  ])("reads %s correctly", (_label, signup, expected) => {
    expect(hasLiveWaitlistOffer(signup)).toBe(expected);
  });
});
