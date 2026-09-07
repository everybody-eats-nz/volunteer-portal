import { prisma } from "@/lib/prisma";
import type { DriverStatus } from "@/generated/client";

/**
 * Driving a van is a capability, not a role. The gate on starting a trip is
 * "has an APPROVED DriverProfile" — never a role check — so a volunteer who
 * also drives stays a volunteer, and an outside borrower who drives never
 * becomes an admin.
 */

export const driverProfileInclude = {
  organisation: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePhotoUrl: true,
    },
  },
  approvedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function getDriverProfile(userId: string) {
  return prisma.driverProfile.findUnique({
    where: { userId },
    include: driverProfileInclude,
  });
}

/** The only gate on starting a trip. */
export async function isApprovedDriver(userId: string): Promise<boolean> {
  const profile = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { status: true },
  });
  return profile?.status === "APPROVED";
}

export interface RegisterDriverInput {
  userId: string;
  licenceClass: string | null;
  licenceExpiry: Date | null;
  organisationId: string | null;
}

/**
 * Self-registration. Always lands as PENDING: the client's stated requirement
 * is "I don't just want anybody drives a van", so approval is a person's
 * decision, never a side effect of filling in a form.
 *
 * Re-registering after being declined puts the driver back in the queue and
 * clears the old decision. A SUSPENDED driver stays suspended — lifting that is
 * an admin's call, not something the driver can undo by resubmitting.
 */
export async function registerDriver(input: RegisterDriverInput) {
  const existing = await prisma.driverProfile.findUnique({
    where: { userId: input.userId },
    select: { status: true },
  });

  const data = {
    licenceClass: input.licenceClass,
    licenceExpiry: input.licenceExpiry,
    organisationId: input.organisationId,
  };

  if (existing?.status === "SUSPENDED") {
    return prisma.driverProfile.update({
      where: { userId: input.userId },
      data,
      include: driverProfileInclude,
    });
  }

  return prisma.driverProfile.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, status: "PENDING", ...data },
    update: {
      ...data,
      status: "PENDING",
      approvedAt: null,
      approvedById: null,
      statusNote: null,
    },
    include: driverProfileInclude,
  });
}

export async function setDriverStatus(
  profileId: string,
  status: DriverStatus,
  adminUserId: string,
  statusNote: string | null
) {
  return prisma.driverProfile.update({
    where: { id: profileId },
    data: {
      status,
      statusNote,
      approvedById: status === "APPROVED" ? adminUserId : null,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
    include: driverProfileInclude,
  });
}

export async function listDriverProfiles(status?: DriverStatus) {
  return prisma.driverProfile.findMany({
    where: status ? { status } : undefined,
    include: driverProfileInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}
