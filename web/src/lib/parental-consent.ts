import { prisma } from "@/lib/prisma";

/**
 * Volunteers who need parental consent, pending first. Dates are ISO strings so
 * the result can be handed straight to a client component or returned as JSON.
 */
export async function getUsersRequiringParentalConsent() {
  const users = await prisma.user.findMany({
    where: {
      requiresParentalConsent: true,
      archivedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      parentalConsentReceived: true,
      parentalConsentReceivedAt: true,
      parentalConsentApprovedBy: true,
      profileCompleted: true,
      createdAt: true,
      phone: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
    orderBy: [
      { parentalConsentReceived: "asc" }, // Show pending first
      { createdAt: "desc" },
    ],
  });

  return users.map((user) => ({
    ...user,
    dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
    parentalConsentReceivedAt:
      user.parentalConsentReceivedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
}

export type ParentalConsentUser = Awaited<
  ReturnType<typeof getUsersRequiringParentalConsent>
>[number];
