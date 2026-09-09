import { prisma } from "@/lib/prisma";
import type { DriverStatus, Prisma } from "@/generated/client";

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

export type DriverProfileWithRelations = Prisma.DriverProfileGetPayload<{
  include: typeof driverProfileInclude;
}>;

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

/**
 * The organisations a person can say they drive for, and a van can belong to.
 *
 * The catch-all is a bucket for one-off borrowers named on a trip, not
 * somewhere a person or a van can belong, and a retired organisation is not an
 * answer to "who do you drive for". Every door that offers this choice — the
 * driver's own form, the office's add-a-driver dialog, the fleet page's
 * "Belongs to", and the guard that stops the last one being retired — reads
 * this one list, so none can start offering an option another rejects.
 */
export async function listSelectableOrganisations() {
  return prisma.organisation.findMany({
    where: { isActive: true, isCatchAll: false },
    orderBy: [{ isInternal: "desc" }, { name: "asc" }],
  });
}

/** The same rule as {@link listSelectableOrganisations}, for a submitted id. */
export async function isSelectableOrganisation(
  organisationId: string
): Promise<boolean> {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { isActive: true, isCatchAll: true },
  });
  return Boolean(org && org.isActive && !org.isCatchAll);
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

export interface AddDriverInput {
  userId: string;
  organisationId: string;
  licenceClass: string | null;
  licenceExpiry: Date | null;
  adminUserId: string;
}

export type AddDriverOutcome = "created" | "approved" | "already-approved";

/**
 * The office adding a driver, for the person who is at the desk or on the phone
 * rather than standing at the van with the sticker in front of them.
 *
 * It lands APPROVED and stamped with the admin who did it, because an admin
 * picking a name out of the user list *is* the approval — the same decision the
 * queue records, made one step earlier. Nothing else about the account changes:
 * driving is a capability, so this writes a DriverProfile and never a role.
 *
 * A driver who is already approved is left exactly as they are. Re-adding
 * somebody by mistake must not quietly rewrite who vouched for them or move
 * them to another organisation.
 */
export async function addDriverAsAdmin(
  input: AddDriverInput
): Promise<{ profile: DriverProfileWithRelations; outcome: AddDriverOutcome }> {
  const existing = await prisma.driverProfile.findUnique({
    where: { userId: input.userId },
    include: driverProfileInclude,
  });

  if (existing?.status === "APPROVED") {
    return { profile: existing, outcome: "already-approved" };
  }

  const approval = {
    status: "APPROVED" as const,
    approvedById: input.adminUserId,
    approvedAt: new Date(),
    // Whatever the last decline or hold said is answered by this one.
    statusNote: null,
  };

  const profile = await prisma.driverProfile.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      organisationId: input.organisationId,
      licenceClass: input.licenceClass,
      licenceExpiry: input.licenceExpiry,
      ...approval,
    },
    update: {
      organisationId: input.organisationId,
      // Blank licence fields mean "the office did not retype them", not "this
      // driver has no licence" — a driver who filled them in on their own form
      // keeps what they sent.
      ...(input.licenceClass ? { licenceClass: input.licenceClass } : {}),
      ...(input.licenceExpiry ? { licenceExpiry: input.licenceExpiry } : {}),
      ...approval,
    },
    include: driverProfileInclude,
  });

  return { profile, outcome: existing ? "approved" : "created" };
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
