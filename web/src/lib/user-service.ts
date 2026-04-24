import { prisma } from "./prisma";
import {
  ArchiveEventType,
  ArchiveReason,
  ArchiveTriggerSource,
} from "@/generated/client";

/**
 * Hard-delete a user and every record that references them, in one transaction.
 * Some relations cascade via the Prisma schema; the explicit deletes cover
 * relations that don't cascade (e.g. Signup, UserAchievement) plus a couple
 * that do — the redundant deletes are harmless and keep the behaviour obvious
 * to any future reader who hasn't memorised the schema.
 */
export async function deleteUserCascade(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.signup.deleteMany({ where: { userId } });
    await tx.adminNote.deleteMany({ where: { volunteerId: userId } });
    await tx.adminNote.deleteMany({ where: { createdBy: userId } });
    await tx.userAchievement.deleteMany({ where: { userId } });
    await tx.userCustomLabel.deleteMany({ where: { userId } });
    await tx.friendRequest.deleteMany({ where: { fromUserId: userId } });
    await tx.friendship.deleteMany({
      where: { OR: [{ userId }, { friendId: userId }] },
    });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.notificationGroupMember.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}

/**
 * User-initiated "delete my account" — archives the user and wipes personal
 * data (name, contact info, photo, credentials) while preserving Signup rows
 * so shift/meal analytics stay intact. Email is tombstoned to a unique,
 * non-routable address so an OAuth sign-in with the original email creates a
 * fresh account instead of resurrecting this one.
 */
export async function archiveAndAnonymizeUser(userId: string): Promise<void> {
  const tombstoneEmail = `deleted-${userId}@deleted.everybodyeats.nz`;

  await prisma.$transaction(async (tx) => {
    // Drop every auth artefact so the account can't be signed into again,
    // even if an attacker still holds a cached token/passkey assertion.
    await tx.passkey.deleteMany({ where: { userId } });
    await tx.webAuthnChallenge.deleteMany({ where: { userId } });
    await tx.pushToken.deleteMany({ where: { userId } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: tombstoneEmail,
        name: null,
        firstName: null,
        lastName: null,
        pronouns: null,
        phone: null,
        dateOfBirth: null,
        profilePhotoUrl: null,
        emergencyContactName: null,
        emergencyContactRelationship: null,
        emergencyContactPhone: null,
        medicalConditions: null,
        hashedPassword: "",
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        migrationInvitationToken: null,
        migrationTokenExpiresAt: null,
        archivedAt: new Date(),
        archiveReason: ArchiveReason.MANUAL,
        archivedBy: null,
        archiveExtensionToken: null,
        archiveExtensionTokenExpiresAt: null,
      },
    });

    // `triggerSource: MANUAL` matches the enum's closest available value; the
    // note disambiguates self-deletion from an admin archive in the audit log.
    // If self-deletion becomes common we can introduce a dedicated enum value
    // in a follow-up migration.
    await tx.archiveLog.create({
      data: {
        userId,
        eventType: ArchiveEventType.ARCHIVED,
        reason: ArchiveReason.MANUAL,
        triggerSource: ArchiveTriggerSource.MANUAL,
        note: "Self-requested account deletion from mobile app",
      },
    });
  });
}
