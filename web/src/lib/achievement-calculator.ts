import { prisma } from "@/lib/prisma";
import { checkAndUnlockAchievements } from "@/lib/achievements";

/**
 * Calculate achievements for users based on their historical data
 * This approach is much simpler and more reliable than event-driven triggers
 */

/**
 * Calculate achievements for a specific user
 * Useful for manual triggers or when we know a specific user completed shifts
 */
export async function calculateAchievementsForUser(userId: string) {
  console.log(`🎯 Calculating achievements for user: ${userId}`);

  try {
    const newAchievements = await checkAndUnlockAchievements(userId);

    if (newAchievements.length > 0) {
      console.log(`🎉 Unlocked ${newAchievements.length} new achievements:`);
      newAchievements.forEach((achievement) => {
        console.log(`   - ${achievement}`);
      });
    } else {
      console.log("📊 No new achievements unlocked");
    }

    return newAchievements;
  } catch (error) {
    console.error(
      `❌ Error calculating achievements for user ${userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Calculate achievements for all users who have any completed shifts
 * This is useful for initial setup or bulk recalculation
 */
export async function recalculateAllAchievements() {
  console.log("🎯 Starting bulk achievement recalculation...");

  try {
    // Get all users who have at least one confirmed signup for a completed shift
    const usersWithCompletedShifts = await prisma.user.findMany({
      where: {
        signups: {
          some: {
            status: "CONFIRMED",
            shift: {
              end: {
                lt: new Date(),
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log(
      `👥 Found ${usersWithCompletedShifts.length} users with completed shifts`
    );

    const results = {
      usersProcessed: 0,
      newAchievements: 0,
      errors: 0,
    };

    for (const user of usersWithCompletedShifts) {
      try {
        const newAchievements = await checkAndUnlockAchievements(user.id);

        if (newAchievements.length > 0) {
          console.log(
            `🎉 Unlocked ${newAchievements.length} achievements for ${
              user.name || user.email
            }:`
          );
          newAchievements.forEach((achievement) => {
            console.log(`   - ${achievement}`);
          });

          results.newAchievements += newAchievements.length;
        }

        results.usersProcessed++;
      } catch (error) {
        console.error(
          `❌ Error processing achievements for user ${user.email}:`,
          error
        );
        results.errors++;
      }
    }

    console.log("📈 Bulk recalculation summary:");
    console.log(`   Users processed: ${results.usersProcessed}`);
    console.log(`   New achievements: ${results.newAchievements}`);
    console.log(`   Errors: ${results.errors}`);

    return results;
  } catch (error) {
    console.error("❌ Error in bulk achievement recalculation:", error);
    throw error;
  }
}
