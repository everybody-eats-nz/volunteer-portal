import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  applySignupAction,
  SignupActionError,
  type SignupAction,
} from "./signup-actions";

// signup-actions reaches into a handful of side-effecting modules. The
// preconditions we care about throw before any of these are touched; the
// happy paths exercise the status transitions with everything stubbed out.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}));
// Hoisted so the tests can assert *which* notification and email a cancel
// picked - waitlist removals and shift cancellations take different channels.
const notificationMocks = vi.hoisted(() => ({
  createShiftConfirmedNotification: vi.fn().mockResolvedValue(undefined),
  createShiftWaitlistedNotification: vi.fn().mockResolvedValue(undefined),
  createShiftCanceledNotification: vi.fn().mockResolvedValue(undefined),
  createWaitlistRemovedNotification: vi.fn().mockResolvedValue(undefined),
}));
const emailMocks = vi.hoisted(() => ({
  sendShiftConfirmationNotification: vi.fn().mockResolvedValue(undefined),
  sendVolunteerNotNeededNotification: vi.fn().mockResolvedValue(undefined),
  sendVolunteerCancellationNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => notificationMocks);
vi.mock("@/lib/email-service", () => ({
  getEmailService: () => emailMocks,
}));
vi.mock("@/lib/signup-utils.server", () => ({
  autoCancelOtherPendingSignupsForDay: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/shift-helpers", () => ({
  isFirstConfirmedShift: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/timezone", () => ({
  formatInNZT: () => "Monday, January 1, 2026",
}));

type SignupStatus =
  | "PENDING"
  | "REGULAR_PENDING"
  | "CONFIRMED"
  | "WAITLISTED"
  | "CANCELED"
  | "NO_SHOW";

function makeSignup(
  status: SignupStatus,
  overrides: { capacity?: number; shiftEnd?: Date } = {}
) {
  const start = new Date("2026-07-01T06:00:00.000Z");
  const end = overrides.shiftEnd ?? new Date("2026-07-01T09:00:00.000Z");
  return {
    id: "signup_1",
    status,
    shiftId: "shift_1",
    shift: {
      id: "shift_1",
      start,
      end,
      location: "Wellington",
      capacity: overrides.capacity ?? 5,
      shiftType: { name: "Dishwashing" },
    },
    user: {
      id: "user_1",
      email: "vol@example.com",
      name: "Sam Volunteer",
      firstName: "Sam",
      lastName: "Volunteer",
    },
  };
}

const mockedFindUnique = vi.mocked(prisma.signup.findUnique);
const mockedUpdate = vi.mocked(prisma.signup.update);
const mockedCount = vi.mocked(prisma.signup.count);

beforeEach(() => {
  vi.clearAllMocks();
  // Fake only setTimeout so the fire-and-forget email timeout race in the
  // source doesn't leave a real 10s timer dangling after the test. Date is
  // left real so the past-shift attendance checks still work.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // Default: update echoes back the requested status. Cast the whole
  // implementation to `never` — Prisma's update() is heavily overloaded and we
  // only care about the data.status round-trip here.
  mockedUpdate.mockImplementation(
    ((args: { data: { status: SignupStatus } }) =>
      Promise.resolve({ id: "signup_1", status: args.data.status })) as never
  );
});

afterEach(() => {
  vi.useRealTimers();
});

/** Capture the thrown SignupActionError without try/catch noise. */
async function expectActionError(
  action: SignupAction,
  expectedStatus: number
): Promise<SignupActionError> {
  const err = await applySignupAction({ signupId: "signup_1", action }).catch(
    (e) => e
  );
  expect(err).toBeInstanceOf(SignupActionError);
  expect((err as SignupActionError).status).toBe(expectedStatus);
  return err as SignupActionError;
}

describe("applySignupAction", () => {
  it("rejects an unknown action with a 400 before any DB read", async () => {
    await expectActionError("not_a_real_action" as SignupAction, 400);
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 with debug context when the signup is missing", async () => {
    mockedFindUnique.mockResolvedValue(null as never);
    const err = await expectActionError("approve", 404);
    expect(err.extra).toMatchObject({ signupId: "signup_1" });
  });

  it("blocks approving a signup that is not pending", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("CONFIRMED") as never);
    await expectActionError("approve", 400);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("blocks confirming a signup that is not waitlisted", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("PENDING") as never);
    await expectActionError("confirm", 400);
  });

  it("blocks cancelling a signup that is neither confirmed nor waitlisted", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("PENDING") as never);
    await expectActionError("cancel", 400);
  });

  it("blocks marking attendance before the shift has ended", async () => {
    mockedFindUnique.mockResolvedValue(
      makeSignup("CONFIRMED", {
        shiftEnd: new Date(Date.now() + 60 * 60 * 1000),
      }) as never
    );
    await expectActionError("mark_absent", 400);
  });

  it("confirms a pending signup when the shift has capacity", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("PENDING") as never);
    mockedCount.mockResolvedValue(2 as never); // below capacity (5)

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "approve",
    });

    expect(result.signup.status).toBe("CONFIRMED");
    expect(result.message).toBe("Signup approved and confirmed");
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CONFIRMED" } })
    );
  });

  it("waitlists an approved signup when the shift is already full", async () => {
    mockedFindUnique.mockResolvedValue(
      makeSignup("PENDING", { capacity: 3 }) as never
    );
    mockedCount.mockResolvedValue(3 as never); // at capacity

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "approve",
    });

    expect(result.signup.status).toBe("WAITLISTED");
    expect(result.message).toBe("Shift was full, moved to waitlist");
  });

  it("blocks manually waitlisting a signup that is not pending", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("CONFIRMED") as never);
    const err = await expectActionError("waitlist", 400);
    expect(err.message).toBe("Only pending signups can be moved to the waitlist");
  });

  it("manually waitlists a pending signup even when the shift has room", async () => {
    mockedFindUnique.mockResolvedValue(
      makeSignup("PENDING", { capacity: 5 }) as never
    );

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "waitlist",
    });

    expect(result.signup.status).toBe("WAITLISTED");
    expect(result.message).toBe("Moved to waitlist and volunteer notified");
    // Capacity is irrelevant to a deliberate park, so it should never be read.
    expect(mockedCount).not.toHaveBeenCalled();
    expect(
      notificationMocks.createShiftWaitlistedNotification
    ).toHaveBeenCalledWith(
      "user_1",
      "Dishwashing",
      expect.any(String),
      "shift_1"
    );
  });

  it("manually waitlists a regular volunteer's auto-generated signup", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("REGULAR_PENDING") as never);

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "waitlist",
    });

    expect(result.signup.status).toBe("WAITLISTED");
  });

  it("rejects a pending signup without emailing unless asked", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("PENDING") as never);

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "reject",
    });

    expect(result.signup.status).toBe("CANCELED");
    expect(result.message).toBe("Signup rejected");
  });

  it("cancels a confirmed signup with the cancellation email", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("CONFIRMED") as never);

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "cancel",
    });

    expect(result.signup.status).toBe("CANCELED");
    expect(result.message).toBe("Signup cancelled and volunteer notified");
    expect(emailMocks.sendVolunteerCancellationNotification).toHaveBeenCalled();
    expect(emailMocks.sendVolunteerNotNeededNotification).not.toHaveBeenCalled();
    expect(notificationMocks.createShiftCanceledNotification).toHaveBeenCalled();
  });

  it("takes a waitlisted signup off the waitlist with the not-needed email", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("WAITLISTED") as never);

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "cancel",
    });

    expect(result.signup.status).toBe("CANCELED");
    expect(result.message).toBe("Removed from waitlist and volunteer notified");
    expect(emailMocks.sendVolunteerNotNeededNotification).toHaveBeenCalled();
    expect(
      emailMocks.sendVolunteerCancellationNotification
    ).not.toHaveBeenCalled();
    expect(notificationMocks.createWaitlistRemovedNotification).toHaveBeenCalled();
    expect(notificationMocks.createShiftCanceledNotification).not.toHaveBeenCalled();
  });

  it("removes a waitlisted signup silently when notifications are skipped", async () => {
    mockedFindUnique.mockResolvedValue(makeSignup("WAITLISTED") as never);

    const result = await applySignupAction({
      signupId: "signup_1",
      action: "cancel",
      skipNotification: true,
    });

    expect(result.message).toBe(
      "Removed from waitlist (no notification sent for past shift)"
    );
    expect(emailMocks.sendVolunteerNotNeededNotification).not.toHaveBeenCalled();
    expect(
      notificationMocks.createWaitlistRemovedNotification
    ).not.toHaveBeenCalled();
  });
});
