import { prisma } from "@/lib/prisma";
import {
  createShiftConfirmedNotification,
  createShiftWaitlistedNotification,
  createShiftCanceledNotification,
} from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";
import { formatInNZT } from "@/lib/timezone";
import { getLocationAddresses } from "@/lib/locations";
import { autoCancelOtherPendingSignupsForDay } from "@/lib/signup-utils.server";
import { isFirstConfirmedShift } from "@/lib/shift-helpers";

export type SignupAction =
  | "approve"
  | "reject"
  | "cancel"
  | "confirm"
  | "mark_present"
  | "mark_absent";

export const SIGNUP_ACTIONS: SignupAction[] = [
  "approve",
  "reject",
  "cancel",
  "confirm",
  "mark_present",
  "mark_absent",
];

/**
 * Thrown by {@link applySignupAction} for any expected failure. `status` is the
 * HTTP status the caller should respond with; `extra` carries optional debug
 * fields (used by the 404 path).
 */
export class SignupActionError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SignupActionError";
  }
}

export interface SignupActionResult {
  /** The updated signup row. */
  signup: Awaited<ReturnType<typeof prisma.signup.update>>;
  /** Human-friendly summary, surfaced to the client. */
  message: string;
}

interface ApplySignupActionOptions {
  signupId: string;
  action: SignupAction;
  /** Send the volunteer an email on reject (mirrors web behaviour). */
  sendEmail?: boolean;
  /** Skip notifications + emails (used when cancelling past shifts). */
  skipNotification?: boolean;
}

function formatNZLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

/**
 * Apply an admin signup action (approve / reject / cancel / confirm /
 * mark_present / mark_absent), including the side effects: status transitions,
 * capacity-aware waitlisting, confirmation/cancellation emails, in-app
 * notifications, and same-day auto-cancellation.
 *
 * Extracted from the web admin PATCH route so the mobile admin API can reuse
 * the exact same behaviour. Authorization is the caller's responsibility.
 */
export async function applySignupAction({
  signupId,
  action,
  sendEmail,
  skipNotification,
}: ApplySignupActionOptions): Promise<SignupActionResult> {
  if (!SIGNUP_ACTIONS.includes(action)) {
    throw new SignupActionError(400, "Invalid action");
  }

  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    include: {
      shift: { include: { shiftType: true } },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!signup) {
    console.error(`Signup not found: signupId=${signupId}`);
    throw new SignupActionError(404, "Signup not found", {
      signupId,
      debug:
        "The signup may have been deleted, canceled, or the ID is incorrect. Please refresh to see the current status.",
    });
  }

  // Per-action status preconditions.
  if (action === "approve" || action === "reject") {
    if (signup.status !== "PENDING" && signup.status !== "REGULAR_PENDING") {
      throw new SignupActionError(
        400,
        "Only pending signups can be approved or rejected"
      );
    }
  } else if (action === "cancel") {
    if (signup.status !== "CONFIRMED") {
      throw new SignupActionError(
        400,
        "Only confirmed signups can be cancelled"
      );
    }
  } else if (action === "confirm") {
    if (signup.status !== "WAITLISTED") {
      throw new SignupActionError(
        400,
        "Only waitlisted signups can be confirmed"
      );
    }
  }

  const volunteerName =
    signup.user.name ||
    `${signup.user.firstName || ""} ${signup.user.lastName || ""}`.trim();
  const locationAddresses = await getLocationAddresses();
  const fullAddress = signup.shift.location
    ? locationAddresses[signup.shift.location] || signup.shift.location
    : "TBD";
  const shiftTime = `${formatInNZT(signup.shift.start, "h:mm a")} - ${formatInNZT(
    signup.shift.end,
    "h:mm a"
  )}`;

  if (action === "approve") {
    const confirmedCount = await prisma.signup.count({
      where: { shiftId: signup.shiftId, status: "CONFIRMED" },
    });

    // Over capacity → waitlist instead of confirming.
    if (confirmedCount >= signup.shift.capacity) {
      const updatedSignup = await prisma.signup.update({
        where: { id: signupId },
        data: { status: "WAITLISTED" },
      });

      try {
        await createShiftWaitlistedNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          formatNZLongDate(signup.shift.start),
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating waitlist notification:", notificationError);
      }

      return {
        signup: updatedSignup,
        message: "Shift was full, moved to waitlist",
      };
    }

    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
      data: { status: "CONFIRMED" },
    });

    try {
      await autoCancelOtherPendingSignupsForDay(
        signup.user.id,
        signup.shiftId,
        signup.shift.start
      );
    } catch (autoCancelError) {
      console.error("Error auto-canceling other signups:", autoCancelError);
    }

    const isFirstShift = await isFirstConfirmedShift(
      signup.user.id,
      signup.shift.id
    );

    if (signup.user.email) {
      const emailService = getEmailService();
      Promise.race([
        emailService.sendShiftConfirmationNotification({
          to: signup.user.email,
          volunteerName,
          shiftName: signup.shift.shiftType.name,
          shiftDate: formatInNZT(signup.shift.start, "EEEE, MMMM d, yyyy"),
          shiftTime,
          location: fullAddress,
          shiftId: signup.shift.id,
          shiftStart: signup.shift.start,
          shiftEnd: signup.shift.end,
          isFirstShift,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), 10000)
        ),
      ]).catch((emailError) => {
        console.error("Error sending confirmation email:", emailError);
      });
    }

    try {
      await createShiftConfirmedNotification(
        signup.user.id,
        signup.shift.shiftType.name,
        formatNZLongDate(signup.shift.start),
        signup.shift.id
      );
    } catch (notificationError) {
      console.error("Error creating confirmation notification:", notificationError);
    }

    return { signup: updatedSignup, message: "Signup approved and confirmed" };
  }

  if (action === "reject") {
    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
      data: { status: "CANCELED" },
    });

    if (sendEmail) {
      if (signup.user.email) {
        const emailService = getEmailService();
        Promise.race([
          emailService.sendVolunteerNotNeededNotification({
            to: signup.user.email,
            volunteerName,
            shiftName: signup.shift.shiftType.name,
            shiftDate: formatInNZT(signup.shift.start, "EEEE, MMMM d, yyyy"),
            shiftTime,
            location: fullAddress,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Email send timeout")), 10000)
          ),
        ]).catch((emailError) => {
          console.error("Error sending not needed email:", emailError);
        });
      }

      try {
        await createShiftCanceledNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          formatNZLongDate(signup.shift.start),
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating rejection notification:", notificationError);
      }
    }

    return {
      signup: updatedSignup,
      message: sendEmail
        ? "Signup rejected and volunteer notified"
        : "Signup rejected",
    };
  }

  if (action === "cancel") {
    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
      data: { status: "CANCELED" },
    });

    if (!skipNotification) {
      if (signup.user.email) {
        const emailService = getEmailService();
        Promise.race([
          emailService.sendVolunteerCancellationNotification({
            to: signup.user.email,
            volunteerName,
            shiftName: signup.shift.shiftType.name,
            shiftDate: formatInNZT(signup.shift.start, "EEEE, MMMM d, yyyy"),
            shiftTime,
            location: fullAddress,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Email send timeout")), 10000)
          ),
        ]).catch((emailError) => {
          console.error("Error sending cancellation email:", emailError);
        });
      }

      try {
        await createShiftCanceledNotification(
          signup.user.id,
          signup.shift.shiftType.name,
          formatNZLongDate(signup.shift.start),
          signup.shift.id
        );
      } catch (notificationError) {
        console.error("Error creating cancellation notification:", notificationError);
      }
    }

    return {
      signup: updatedSignup,
      message: skipNotification
        ? "Signup cancelled (no notification sent for past shift)"
        : "Signup cancelled and volunteer notified",
    };
  }

  if (action === "confirm") {
    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
      data: { status: "CONFIRMED" },
    });

    try {
      await autoCancelOtherPendingSignupsForDay(
        signup.user.id,
        signup.shiftId,
        signup.shift.start
      );
    } catch (autoCancelError) {
      console.error("Error auto-canceling other signups:", autoCancelError);
    }

    const isFirstShift = await isFirstConfirmedShift(
      signup.user.id,
      signup.shift.id
    );

    if (signup.user.email) {
      const emailService = getEmailService();
      Promise.race([
        emailService.sendShiftConfirmationNotification({
          to: signup.user.email,
          volunteerName,
          shiftName: signup.shift.shiftType.name,
          shiftDate: formatInNZT(signup.shift.start, "EEEE, MMMM d, yyyy"),
          shiftTime,
          location: fullAddress,
          shiftId: signup.shift.id,
          shiftStart: signup.shift.start,
          shiftEnd: signup.shift.end,
          isFirstShift,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), 10000)
        ),
      ]).catch((emailError) => {
        console.error("Error sending confirmation email:", emailError);
      });
    }

    try {
      await createShiftConfirmedNotification(
        signup.user.id,
        signup.shift.shiftType.name,
        formatNZLongDate(signup.shift.start),
        signup.shift.id
      );
    } catch (notificationError) {
      console.error("Error creating confirmation notification:", notificationError);
    }

    return { signup: updatedSignup, message: "Signup confirmed and volunteer notified" };
  }

  if (action === "mark_absent") {
    if (signup.status !== "CONFIRMED") {
      throw new SignupActionError(
        400,
        "Only confirmed signups can be marked as absent"
      );
    }
    if (new Date() < signup.shift.end) {
      throw new SignupActionError(
        400,
        "Can only mark attendance for past shifts"
      );
    }

    const updatedSignup = await prisma.signup.update({
      where: { id: signupId },
      data: { status: "NO_SHOW" },
    });
    return { signup: updatedSignup, message: "Volunteer marked as no show" };
  }

  // action === "mark_present"
  if (signup.status !== "NO_SHOW" && signup.status !== "CONFIRMED") {
    throw new SignupActionError(
      400,
      "Only confirmed or no-show signups can have attendance marked"
    );
  }
  if (new Date() < signup.shift.end) {
    throw new SignupActionError(400, "Can only mark attendance for past shifts");
  }

  const updatedSignup = await prisma.signup.update({
    where: { id: signupId },
    data: { status: "CONFIRMED" },
  });
  return { signup: updatedSignup, message: "Volunteer attendance confirmed" };
}
