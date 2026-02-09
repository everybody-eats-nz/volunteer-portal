import { prisma } from "@/lib/prisma";

/**
 * Custom error class for merge operations with specific error codes
 */
export class MergeError extends Error {
  constructor(
    message: string,
    public code:
      | "SAME_USER"
      | "TARGET_NOT_FOUND"
      | "SOURCE_NOT_FOUND"
      | "ADMIN_NOT_FOUND"
      | "ADMIN_NOT_AUTHORIZED"
      | "USER_DELETED_DURING_MERGE"
      | "TRANSACTION_FAILED"
  ) {
    super(message);
    this.name = "MergeError";
  }
}

/**
 * Helper function to count duplicates between target and source items.
 * Returns the count of items that exist in both sets based on the key selector.
 */
function countDuplicates<T>(
  targetItems: T[],
  sourceItems: T[],
  keySelector: (item: T) => string
): number {
  const targetKeys = new Set(targetItems.map(keySelector));
  return sourceItems.filter((item) => targetKeys.has(keySelector(item))).length;
}

export interface MergeStats {
  signups: { transferred: number; skipped: number };
  achievements: { transferred: number; skipped: number };
  groupBookings: { transferred: number; skipped: number };
  groupInvitations: { transferred: number; skipped: number };
  friendships: { transferred: number; skipped: number };
  friendRequests: { transferred: number; skipped: number };
  notifications: { transferred: number; skipped: number };
  restaurantManager: { transferred: boolean; kept: boolean };
  regularVolunteers: { transferred: number; skipped: number };
  notificationGroupMembers: { transferred: number; skipped: number };
  autoAcceptRules: { transferred: number; skipped: number };
  autoApprovals: { transferred: number; skipped: number };
  adminNotes: { transferred: number; skipped: number };
  customLabels: { transferred: number; skipped: number };
  resources: { transferred: number; skipped: number };
  shiftTemplates: { transferred: number; skipped: number };
  surveyAssignments: { transferred: number; skipped: number };
  surveys: { transferred: number; skipped: number };
  passkeys: { transferred: number; skipped: number };
}

export interface MergePreview {
  targetUser: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl: string | null;
    role: string;
    signupCount: number;
    achievementCount: number;
    friendshipCount: number;
  };
  sourceUser: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePhotoUrl: string | null;
    role: string;
    signupCount: number;
    achievementCount: number;
    friendshipCount: number;
  };
  conflicts: {
    duplicateSignups: number;
    duplicateAchievements: number;
    duplicateFriendships: number;
    duplicateCustomLabels: number;
    duplicateSurveyAssignments: number;
    selfFriendships: number;
    duplicateGroupBookings: number;
    duplicateNotificationGroupMembers: number;
    duplicateFriendRequests: number;
    duplicateRegularVolunteers: number;
  };
  estimatedStats: {
    signups: { toTransfer: number; toSkip: number };
    achievements: { toTransfer: number; toSkip: number };
    friendships: { toTransfer: number; toSkip: number };
    customLabels: { toTransfer: number; toSkip: number };
    notifications: number;
    adminNotes: number;
    resources: number;
    groupBookings: { toTransfer: number; toSkip: number };
    groupInvitations: number;
    notificationGroupMembers: { toTransfer: number; toSkip: number };
    friendRequests: { toTransfer: number; toSkip: number };
    autoAcceptRules: number;
    autoApprovals: number;
    shiftTemplates: number;
    surveyAssignments: { toTransfer: number; toSkip: number };
    surveys: number;
    passkeys: number;
    restaurantManager: boolean;
    regularVolunteers: { toTransfer: number; toSkip: number };
  };
}

export interface MergeResult {
  success: boolean;
  stats: MergeStats;
  targetUser: {
    id: string;
    email: string;
    name: string | null;
  };
  deletedSourceEmail: string;
}

/**
 * Get a preview of what will happen if two users are merged.
 * Target user keeps their profile, source user's data is transferred to them.
 */
export async function getMergePreview(
  targetId: string,
  sourceId: string
): Promise<MergePreview> {
  if (targetId === sourceId) {
    throw new Error("Cannot merge a user with themselves");
  }

  // Fetch both users with their related data counts
  const [targetUser, sourceUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        role: true,
        restaurantManager: { select: { id: true } },
        regularVolunteers: { select: { id: true, shiftTypeId: true } },
        _count: {
          select: {
            signups: true,
            achievements: true,
            friendships: true,
            customLabels: true,
            notifications: true,
            adminNotes: true,
            uploadedResources: true,
            ledGroupBookings: true,
            groupInvitationsSent: true,
            notificationGroupMembers: true,
            sentFriendRequests: true,
            createdAutoAcceptRules: true,
            overriddenAutoApprovals: true,
            createdShiftTemplates: true,
            surveyAssignments: true,
            createdSurveys: true,
            passkeys: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        role: true,
        restaurantManager: { select: { id: true } },
        regularVolunteers: { select: { id: true, shiftTypeId: true } },
        _count: {
          select: {
            signups: true,
            achievements: true,
            friendships: true,
            customLabels: true,
            notifications: true,
            adminNotes: true,
            uploadedResources: true,
            ledGroupBookings: true,
            groupInvitationsSent: true,
            notificationGroupMembers: true,
            sentFriendRequests: true,
            createdAutoAcceptRules: true,
            overriddenAutoApprovals: true,
            createdShiftTemplates: true,
            surveyAssignments: true,
            createdSurveys: true,
            passkeys: true,
          },
        },
      },
    }),
  ]);

  if (!targetUser) {
    throw new Error("Target user not found");
  }
  if (!sourceUser) {
    throw new Error("Source user not found");
  }

  // Fetch all data needed for conflict detection in parallel
  const [
    targetSignups,
    sourceSignups,
    targetAchievements,
    sourceAchievements,
    targetFriendships,
    sourceFriendships,
    targetCustomLabels,
    sourceCustomLabels,
    targetSurveyAssignments,
    sourceSurveyAssignments,
    targetGroupBookings,
    sourceGroupBookings,
    targetNotificationGroupMembers,
    sourceNotificationGroupMembers,
    targetFriendRequests,
    sourceFriendRequests,
  ] = await Promise.all([
    prisma.signup.findMany({ where: { userId: targetId }, select: { shiftId: true } }),
    prisma.signup.findMany({ where: { userId: sourceId }, select: { shiftId: true } }),
    prisma.userAchievement.findMany({ where: { userId: targetId }, select: { achievementId: true } }),
    prisma.userAchievement.findMany({ where: { userId: sourceId }, select: { achievementId: true } }),
    prisma.friendship.findMany({ where: { userId: targetId }, select: { friendId: true } }),
    prisma.friendship.findMany({ where: { userId: sourceId }, select: { friendId: true } }),
    prisma.userCustomLabel.findMany({ where: { userId: targetId }, select: { labelId: true } }),
    prisma.userCustomLabel.findMany({ where: { userId: sourceId }, select: { labelId: true } }),
    prisma.surveyAssignment.findMany({ where: { userId: targetId }, select: { surveyId: true } }),
    prisma.surveyAssignment.findMany({ where: { userId: sourceId }, select: { surveyId: true } }),
    prisma.groupBooking.findMany({ where: { leaderId: targetId }, select: { shiftId: true } }),
    prisma.groupBooking.findMany({ where: { leaderId: sourceId }, select: { shiftId: true } }),
    prisma.notificationGroupMember.findMany({ where: { userId: targetId }, select: { groupId: true } }),
    prisma.notificationGroupMember.findMany({ where: { userId: sourceId }, select: { groupId: true } }),
    prisma.friendRequest.findMany({ where: { fromUserId: targetId }, select: { toEmail: true } }),
    prisma.friendRequest.findMany({ where: { fromUserId: sourceId }, select: { toEmail: true } }),
  ]);

  // Count duplicates using helper function
  const duplicateSignups = countDuplicates(targetSignups, sourceSignups, (s) => s.shiftId);
  const duplicateAchievements = countDuplicates(targetAchievements, sourceAchievements, (a) => a.achievementId);
  const duplicateCustomLabels = countDuplicates(targetCustomLabels, sourceCustomLabels, (l) => l.labelId);
  const duplicateSurveyAssignments = countDuplicates(targetSurveyAssignments, sourceSurveyAssignments, (s) => s.surveyId);
  const duplicateGroupBookings = countDuplicates(targetGroupBookings, sourceGroupBookings, (g) => g.shiftId);
  const duplicateNotificationGroupMembers = countDuplicates(
    targetNotificationGroupMembers,
    sourceNotificationGroupMembers,
    (m) => m.groupId
  );
  const duplicateFriendRequests = countDuplicates(targetFriendRequests, sourceFriendRequests, (r) => r.toEmail);

  // Friendships have special logic: also count self-references
  const targetFriendIds = new Set(targetFriendships.map((f) => f.friendId));
  const duplicateFriendships = sourceFriendships.filter(
    (f) =>
      targetFriendIds.has(f.friendId) ||
      f.friendId === targetId ||
      f.friendId === sourceId
  ).length;
  const selfFriendships = sourceFriendships.filter(
    (f) => f.friendId === targetId || f.friendId === sourceId
  ).length;

  // Regular volunteers: count duplicates based on shiftTypeId
  const targetRegularShiftTypeIds = new Set(
    targetUser.regularVolunteers.map((r) => r.shiftTypeId)
  );
  const duplicateRegularVolunteers = sourceUser.regularVolunteers.filter((r) =>
    targetRegularShiftTypeIds.has(r.shiftTypeId)
  ).length;

  return {
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      profilePhotoUrl: targetUser.profilePhotoUrl,
      role: targetUser.role,
      signupCount: targetUser._count.signups,
      achievementCount: targetUser._count.achievements,
      friendshipCount: targetUser._count.friendships,
    },
    sourceUser: {
      id: sourceUser.id,
      email: sourceUser.email,
      name: sourceUser.name,
      firstName: sourceUser.firstName,
      lastName: sourceUser.lastName,
      profilePhotoUrl: sourceUser.profilePhotoUrl,
      role: sourceUser.role,
      signupCount: sourceUser._count.signups,
      achievementCount: sourceUser._count.achievements,
      friendshipCount: sourceUser._count.friendships,
    },
    conflicts: {
      duplicateSignups,
      duplicateAchievements,
      duplicateFriendships,
      duplicateCustomLabels,
      duplicateSurveyAssignments,
      selfFriendships,
      duplicateGroupBookings,
      duplicateNotificationGroupMembers,
      duplicateFriendRequests,
      duplicateRegularVolunteers,
    },
    estimatedStats: {
      signups: {
        toTransfer: sourceUser._count.signups - duplicateSignups,
        toSkip: duplicateSignups,
      },
      achievements: {
        toTransfer: sourceUser._count.achievements - duplicateAchievements,
        toSkip: duplicateAchievements,
      },
      friendships: {
        toTransfer: sourceUser._count.friendships - duplicateFriendships,
        toSkip: duplicateFriendships,
      },
      customLabels: {
        toTransfer: sourceUser._count.customLabels - duplicateCustomLabels,
        toSkip: duplicateCustomLabels,
      },
      notifications: sourceUser._count.notifications,
      adminNotes: sourceUser._count.adminNotes,
      resources: sourceUser._count.uploadedResources,
      groupBookings: {
        toTransfer: sourceUser._count.ledGroupBookings - duplicateGroupBookings,
        toSkip: duplicateGroupBookings,
      },
      groupInvitations: sourceUser._count.groupInvitationsSent,
      notificationGroupMembers: {
        toTransfer:
          sourceUser._count.notificationGroupMembers -
          duplicateNotificationGroupMembers,
        toSkip: duplicateNotificationGroupMembers,
      },
      friendRequests: {
        toTransfer:
          sourceUser._count.sentFriendRequests - duplicateFriendRequests,
        toSkip: duplicateFriendRequests,
      },
      autoAcceptRules: sourceUser._count.createdAutoAcceptRules,
      autoApprovals: sourceUser._count.overriddenAutoApprovals,
      shiftTemplates: sourceUser._count.createdShiftTemplates,
      surveyAssignments: {
        toTransfer:
          sourceUser._count.surveyAssignments - duplicateSurveyAssignments,
        toSkip: duplicateSurveyAssignments,
      },
      surveys: sourceUser._count.createdSurveys,
      passkeys: sourceUser._count.passkeys,
      restaurantManager:
        !targetUser.restaurantManager && !!sourceUser.restaurantManager,
      regularVolunteers: {
        toTransfer:
          sourceUser.regularVolunteers.length - duplicateRegularVolunteers,
        toSkip: duplicateRegularVolunteers,
      },
    },
  };
}

/**
 * Execute the user merge operation.
 * Transfers all data from source user to target user, then deletes source user.
 */
export async function executeUserMerge(
  targetId: string,
  sourceId: string,
  adminId: string
): Promise<MergeResult> {
  // Validate IDs are not the same
  if (targetId === sourceId) {
    throw new MergeError("Cannot merge a user with themselves", "SAME_USER");
  }

  // Pre-flight validation: verify all users exist and admin has permission
  const [targetUser, sourceUser, adminUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: sourceId },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    }),
  ]);

  if (!targetUser) {
    throw new MergeError(
      `Target user with ID ${targetId} not found`,
      "TARGET_NOT_FOUND"
    );
  }
  if (!sourceUser) {
    throw new MergeError(
      `Source user with ID ${sourceId} not found`,
      "SOURCE_NOT_FOUND"
    );
  }
  if (!adminUser) {
    throw new MergeError(
      `Admin user with ID ${adminId} not found`,
      "ADMIN_NOT_FOUND"
    );
  }
  if (adminUser.role !== "ADMIN") {
    throw new MergeError(
      "Only admins can perform user merges",
      "ADMIN_NOT_AUTHORIZED"
    );
  }

  const stats: MergeStats = {
    signups: { transferred: 0, skipped: 0 },
    achievements: { transferred: 0, skipped: 0 },
    groupBookings: { transferred: 0, skipped: 0 },
    groupInvitations: { transferred: 0, skipped: 0 },
    friendships: { transferred: 0, skipped: 0 },
    friendRequests: { transferred: 0, skipped: 0 },
    notifications: { transferred: 0, skipped: 0 },
    restaurantManager: { transferred: false, kept: false },
    regularVolunteers: { transferred: 0, skipped: 0 },
    notificationGroupMembers: { transferred: 0, skipped: 0 },
    autoAcceptRules: { transferred: 0, skipped: 0 },
    autoApprovals: { transferred: 0, skipped: 0 },
    adminNotes: { transferred: 0, skipped: 0 },
    customLabels: { transferred: 0, skipped: 0 },
    resources: { transferred: 0, skipped: 0 },
    shiftTemplates: { transferred: 0, skipped: 0 },
    surveyAssignments: { transferred: 0, skipped: 0 },
    surveys: { transferred: 0, skipped: 0 },
    passkeys: { transferred: 0, skipped: 0 },
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        // Re-validate users exist inside transaction to prevent race conditions
        const [txTargetUser, txSourceUser] = await Promise.all([
          tx.user.findUnique({ where: { id: targetId }, select: { id: true } }),
          tx.user.findUnique({ where: { id: sourceId }, select: { id: true } }),
        ]);

        if (!txTargetUser || !txSourceUser) {
          throw new MergeError(
            "One or both users were deleted during the merge operation",
            "USER_DELETED_DURING_MERGE"
          );
        }

        // 1. Transfer Signups (skip duplicates based on [userId, shiftId])
      const targetSignups = await tx.signup.findMany({
        where: { userId: targetId },
        select: { shiftId: true },
      });
      const targetShiftIds = new Set(targetSignups.map((s) => s.shiftId));

      const sourceSignups = await tx.signup.findMany({
        where: { userId: sourceId },
        select: { id: true, shiftId: true },
      });

      for (const signup of sourceSignups) {
        if (targetShiftIds.has(signup.shiftId)) {
          // Delete duplicate - target already has signup for this shift
          await tx.signup.delete({ where: { id: signup.id } });
          stats.signups.skipped++;
        } else {
          await tx.signup.update({
            where: { id: signup.id },
            data: { userId: targetId },
          });
          stats.signups.transferred++;
        }
      }

      // 2. Transfer UserAchievements (skip duplicates based on [userId, achievementId])
      const targetAchievements = await tx.userAchievement.findMany({
        where: { userId: targetId },
        select: { achievementId: true },
      });
      const targetAchievementIds = new Set(
        targetAchievements.map((a) => a.achievementId)
      );

      const sourceAchievements = await tx.userAchievement.findMany({
        where: { userId: sourceId },
        select: { id: true, achievementId: true },
      });

      for (const achievement of sourceAchievements) {
        if (targetAchievementIds.has(achievement.achievementId)) {
          // Delete duplicate - target already has this achievement
          await tx.userAchievement.delete({ where: { id: achievement.id } });
          stats.achievements.skipped++;
        } else {
          await tx.userAchievement.update({
            where: { id: achievement.id },
            data: { userId: targetId },
          });
          stats.achievements.transferred++;
        }
      }

      // 3. Transfer GroupBookings (skip duplicates based on [shiftId, leaderId])
      const targetGroupBookings = await tx.groupBooking.findMany({
        where: { leaderId: targetId },
        select: { shiftId: true },
      });
      const targetGroupBookingShiftIds = new Set(
        targetGroupBookings.map((g) => g.shiftId)
      );

      const sourceGroupBookings = await tx.groupBooking.findMany({
        where: { leaderId: sourceId },
        select: { id: true, shiftId: true },
      });

      for (const groupBooking of sourceGroupBookings) {
        if (targetGroupBookingShiftIds.has(groupBooking.shiftId)) {
          // Delete duplicate - target already leads a group for this shift
          await tx.groupBooking.delete({ where: { id: groupBooking.id } });
          stats.groupBookings.skipped++;
        } else {
          await tx.groupBooking.update({
            where: { id: groupBooking.id },
            data: { leaderId: targetId },
          });
          stats.groupBookings.transferred++;
        }
      }

      // 4. Transfer GroupInvitations (transfer all)
      const groupInvitationsResult = await tx.groupInvitation.updateMany({
        where: { invitedById: sourceId },
        data: { invitedById: targetId },
      });
      stats.groupInvitations.transferred = groupInvitationsResult.count;

      // 5. Transfer Friendships (skip duplicates and self-friendships)
      const targetFriendships = await tx.friendship.findMany({
        where: { userId: targetId },
        select: { friendId: true },
      });
      const targetFriendIds = new Set(targetFriendships.map((f) => f.friendId));

      const sourceFriendships = await tx.friendship.findMany({
        where: { userId: sourceId },
        select: { id: true, friendId: true },
      });

      for (const friendship of sourceFriendships) {
        // Delete if it would create a self-friendship or duplicate
        if (
          friendship.friendId === targetId ||
          friendship.friendId === sourceId ||
          targetFriendIds.has(friendship.friendId)
        ) {
          await tx.friendship.delete({ where: { id: friendship.id } });
          stats.friendships.skipped++;
        } else {
          await tx.friendship.update({
            where: { id: friendship.id },
            data: { userId: targetId },
          });
          stats.friendships.transferred++;
        }
      }

      // Also update initiatedBy references and friendOf references
      // Update friendships where source is the initiator
      await tx.friendship.updateMany({
        where: { initiatedBy: sourceId },
        data: { initiatedBy: targetId },
      });

      // Update friendships where source is the friend (the other side of bidirectional)
      // Need to handle carefully to avoid duplicates
      const reverseFriendships = await tx.friendship.findMany({
        where: { friendId: sourceId },
        select: { id: true, userId: true },
      });

      for (const friendship of reverseFriendships) {
        // Check if target already has a friendship with this user
        const existingFriendship = await tx.friendship.findUnique({
          where: {
            userId_friendId: {
              userId: friendship.userId,
              friendId: targetId,
            },
          },
        });

        if (existingFriendship || friendship.userId === targetId) {
          // Delete this friendship (duplicate or self-friendship)
          await tx.friendship.delete({
            where: { id: friendship.id },
          });
        } else {
          await tx.friendship.update({
            where: { id: friendship.id },
            data: { friendId: targetId },
          });
        }
      }

      // 6. Transfer FriendRequests (skip duplicates based on [fromUserId, toEmail])
      const targetFriendRequests = await tx.friendRequest.findMany({
        where: { fromUserId: targetId },
        select: { toEmail: true },
      });
      const targetFriendRequestEmails = new Set(
        targetFriendRequests.map((r) => r.toEmail)
      );

      const sourceFriendRequests = await tx.friendRequest.findMany({
        where: { fromUserId: sourceId },
        select: { id: true, toEmail: true },
      });

      for (const request of sourceFriendRequests) {
        if (targetFriendRequestEmails.has(request.toEmail)) {
          // Delete duplicate - target already sent request to this email
          await tx.friendRequest.delete({ where: { id: request.id } });
          stats.friendRequests.skipped++;
        } else {
          await tx.friendRequest.update({
            where: { id: request.id },
            data: { fromUserId: targetId },
          });
          stats.friendRequests.transferred++;
        }
      }

      // 7. Transfer Notifications (transfer all)
      const notificationsResult = await tx.notification.updateMany({
        where: { userId: sourceId },
        data: { userId: targetId },
      });
      stats.notifications.transferred = notificationsResult.count;

      // 8. RestaurantManager (keep target's if exists, otherwise transfer)
      const targetRestaurantManager = await tx.restaurantManager.findUnique({
        where: { userId: targetId },
      });
      const sourceRestaurantManager = await tx.restaurantManager.findUnique({
        where: { userId: sourceId },
      });

      if (targetRestaurantManager) {
        stats.restaurantManager.kept = true;
        if (sourceRestaurantManager) {
          await tx.restaurantManager.delete({
            where: { userId: sourceId },
          });
        }
      } else if (sourceRestaurantManager) {
        await tx.restaurantManager.update({
          where: { userId: sourceId },
          data: { userId: targetId },
        });
        stats.restaurantManager.transferred = true;
      }

      // 9. RegularVolunteers (skip duplicates based on [userId, shiftTypeId])
      const targetRegularVolunteers = await tx.regularVolunteer.findMany({
        where: { userId: targetId },
        select: { shiftTypeId: true },
      });
      const targetRegularShiftTypeIds = new Set(
        targetRegularVolunteers.map((r) => r.shiftTypeId)
      );

      const sourceRegularVolunteers = await tx.regularVolunteer.findMany({
        where: { userId: sourceId },
        select: { id: true, shiftTypeId: true },
      });

      for (const regular of sourceRegularVolunteers) {
        if (targetRegularShiftTypeIds.has(regular.shiftTypeId)) {
          // Delete duplicate - target already has a regular for this shift type
          await tx.regularVolunteer.delete({ where: { id: regular.id } });
          stats.regularVolunteers.skipped++;
        } else {
          await tx.regularVolunteer.update({
            where: { id: regular.id },
            data: { userId: targetId },
          });
          stats.regularVolunteers.transferred++;
        }
      }

      // 10. NotificationGroupMembers (skip duplicates based on [groupId, userId])
      const targetNotificationGroupMembers =
        await tx.notificationGroupMember.findMany({
          where: { userId: targetId },
          select: { groupId: true },
        });
      const targetNotificationGroupIds = new Set(
        targetNotificationGroupMembers.map((m) => m.groupId)
      );

      const sourceNotificationGroupMembers =
        await tx.notificationGroupMember.findMany({
          where: { userId: sourceId },
          select: { id: true, groupId: true },
        });

      for (const member of sourceNotificationGroupMembers) {
        if (targetNotificationGroupIds.has(member.groupId)) {
          // Delete duplicate - target already in this group
          await tx.notificationGroupMember.delete({ where: { id: member.id } });
          stats.notificationGroupMembers.skipped++;
        } else {
          await tx.notificationGroupMember.update({
            where: { id: member.id },
            data: { userId: targetId },
          });
          stats.notificationGroupMembers.transferred++;
        }
      }

      // 11. AutoAcceptRules (transfer createdBy)
      const autoAcceptRulesResult = await tx.autoAcceptRule.updateMany({
        where: { createdBy: sourceId },
        data: { createdBy: targetId },
      });
      stats.autoAcceptRules.transferred = autoAcceptRulesResult.count;

      // 12. AutoApprovals (transfer overriddenBy)
      const autoApprovalsResult = await tx.autoApproval.updateMany({
        where: { overriddenBy: sourceId },
        data: { overriddenBy: targetId },
      });
      stats.autoApprovals.transferred = autoApprovalsResult.count;

      // 13. AdminNotes (transfer both volunteerId and createdBy references)
      // Notes about the source user
      const volunteerNotesResult = await tx.adminNote.updateMany({
        where: { volunteerId: sourceId },
        data: { volunteerId: targetId },
      });
      // Notes created by the source user
      const creatorNotesResult = await tx.adminNote.updateMany({
        where: { createdBy: sourceId },
        data: { createdBy: targetId },
      });
      stats.adminNotes.transferred =
        volunteerNotesResult.count + creatorNotesResult.count;

      // 14. UserCustomLabels (skip duplicates based on [userId, labelId])
      const targetCustomLabels = await tx.userCustomLabel.findMany({
        where: { userId: targetId },
        select: { labelId: true },
      });
      const targetLabelIds = new Set(targetCustomLabels.map((l) => l.labelId));

      const sourceCustomLabels = await tx.userCustomLabel.findMany({
        where: { userId: sourceId },
        select: { id: true, labelId: true },
      });

      for (const label of sourceCustomLabels) {
        if (targetLabelIds.has(label.labelId)) {
          // Delete duplicate - target already has this label
          await tx.userCustomLabel.delete({ where: { id: label.id } });
          stats.customLabels.skipped++;
        } else {
          await tx.userCustomLabel.update({
            where: { id: label.id },
            data: { userId: targetId },
          });
          stats.customLabels.transferred++;
        }
      }

      // 15. Resources (transfer uploadedBy)
      const resourcesResult = await tx.resource.updateMany({
        where: { uploadedBy: sourceId },
        data: { uploadedBy: targetId },
      });
      stats.resources.transferred = resourcesResult.count;

      // 16. ShiftTemplates (transfer createdBy)
      const shiftTemplatesResult = await tx.shiftTemplate.updateMany({
        where: { createdBy: sourceId },
        data: { createdBy: targetId },
      });
      stats.shiftTemplates.transferred = shiftTemplatesResult.count;

      // 17. SurveyAssignments (skip duplicates based on [surveyId, userId])
      const targetSurveyAssignments = await tx.surveyAssignment.findMany({
        where: { userId: targetId },
        select: { surveyId: true },
      });
      const targetSurveyIds = new Set(
        targetSurveyAssignments.map((s) => s.surveyId)
      );

      const sourceSurveyAssignments = await tx.surveyAssignment.findMany({
        where: { userId: sourceId },
        select: { id: true, surveyId: true },
      });

      for (const assignment of sourceSurveyAssignments) {
        if (targetSurveyIds.has(assignment.surveyId)) {
          // Delete duplicate - target already has this survey assignment
          await tx.surveyAssignment.delete({ where: { id: assignment.id } });
          stats.surveyAssignments.skipped++;
        } else {
          await tx.surveyAssignment.update({
            where: { id: assignment.id },
            data: { userId: targetId },
          });
          stats.surveyAssignments.transferred++;
        }
      }

      // 18. Surveys (transfer createdBy)
      const surveysResult = await tx.survey.updateMany({
        where: { createdBy: sourceId },
        data: { createdBy: targetId },
      });
      stats.surveys.transferred = surveysResult.count;

      // 19. Passkeys (transfer all)
      const passkeysResult = await tx.passkey.updateMany({
        where: { userId: sourceId },
        data: { userId: targetId },
      });
      stats.passkeys.transferred = passkeysResult.count;

      // 20. Create audit AdminNote documenting the merge
      const auditNote = createAuditNote(sourceUser.email, sourceId, stats);
      await tx.adminNote.create({
        data: {
          volunteerId: targetId,
          createdBy: adminId,
          content: auditNote,
        },
      });

      // 21. Delete the source user
      await tx.user.delete({
        where: { id: sourceId },
      });
      },
      {
        timeout: 60000, // 60 second timeout for complex merge operations
        isolationLevel: "Serializable", // Ensure data consistency
      }
    );
  } catch (error) {
    // Re-throw MergeErrors as-is
    if (error instanceof MergeError) {
      throw error;
    }

    // Handle Prisma-specific errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("foreign key constraint")) {
        throw new MergeError(
          "Cannot complete merge: some data references could not be transferred. " +
            "This may be due to database constraints. Please try again or contact support.",
          "TRANSACTION_FAILED"
        );
      }

      if (message.includes("unique constraint")) {
        throw new MergeError(
          "Cannot complete merge: duplicate data conflict detected. " +
            "Please refresh and try again.",
          "TRANSACTION_FAILED"
        );
      }

      if (message.includes("timeout") || message.includes("timed out")) {
        throw new MergeError(
          "Merge operation timed out. The users may have too much data to merge. " +
            "Please contact support for assistance.",
          "TRANSACTION_FAILED"
        );
      }
    }

    // Generic transaction failure
    throw new MergeError(
      `Merge transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      "TRANSACTION_FAILED"
    );
  }

  return {
    success: true,
    stats,
    targetUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
    },
    deletedSourceEmail: sourceUser.email,
  };
}

function createAuditNote(
  sourceEmail: string,
  sourceId: string,
  stats: MergeStats
): string {
  const lines = [
    `Account merged from ${sourceEmail} (ID: ${sourceId}) on ${new Date().toISOString()}.`,
    "",
    "Stats transferred:",
  ];

  if (stats.signups.transferred > 0 || stats.signups.skipped > 0) {
    lines.push(
      `- Signups: ${stats.signups.transferred} transferred${stats.signups.skipped > 0 ? ` (${stats.signups.skipped} duplicates skipped)` : ""}`
    );
  }

  if (stats.achievements.transferred > 0 || stats.achievements.skipped > 0) {
    lines.push(
      `- Achievements: ${stats.achievements.transferred} transferred${stats.achievements.skipped > 0 ? ` (${stats.achievements.skipped} duplicates skipped)` : ""}`
    );
  }

  if (stats.friendships.transferred > 0 || stats.friendships.skipped > 0) {
    lines.push(
      `- Friendships: ${stats.friendships.transferred} transferred${stats.friendships.skipped > 0 ? ` (${stats.friendships.skipped} duplicates/self-refs skipped)` : ""}`
    );
  }

  if (
    stats.groupBookings.transferred > 0 ||
    stats.groupBookings.skipped > 0
  ) {
    lines.push(
      `- Group Bookings: ${stats.groupBookings.transferred} transferred${stats.groupBookings.skipped > 0 ? ` (${stats.groupBookings.skipped} duplicates skipped)` : ""}`
    );
  }

  if (stats.groupInvitations.transferred > 0) {
    lines.push(`- Group Invitations: ${stats.groupInvitations.transferred}`);
  }

  if (stats.notifications.transferred > 0) {
    lines.push(`- Notifications: ${stats.notifications.transferred}`);
  }

  if (
    stats.customLabels.transferred > 0 ||
    stats.customLabels.skipped > 0
  ) {
    lines.push(
      `- Custom Labels: ${stats.customLabels.transferred} transferred${stats.customLabels.skipped > 0 ? ` (${stats.customLabels.skipped} duplicates skipped)` : ""}`
    );
  }

  if (stats.adminNotes.transferred > 0) {
    lines.push(`- Admin Notes: ${stats.adminNotes.transferred}`);
  }

  if (stats.resources.transferred > 0) {
    lines.push(`- Resources: ${stats.resources.transferred}`);
  }

  if (stats.passkeys.transferred > 0) {
    lines.push(`- Passkeys: ${stats.passkeys.transferred}`);
  }

  if (stats.restaurantManager.transferred) {
    lines.push("- Restaurant Manager status transferred");
  } else if (stats.restaurantManager.kept) {
    lines.push("- Restaurant Manager status kept (target already had one)");
  }

  if (stats.regularVolunteers.transferred > 0 || stats.regularVolunteers.skipped > 0) {
    lines.push(
      `- Regular Volunteers: ${stats.regularVolunteers.transferred} transferred${stats.regularVolunteers.skipped > 0 ? ` (${stats.regularVolunteers.skipped} duplicates skipped)` : ""}`
    );
  }

  return lines.join("\n");
}
