import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/utils";

/**
 * Checks if a user is under 18 years old based on their date of birth
 */
export function isUserUnder18(dateOfBirth: Date | null): boolean {
  if (!dateOfBirth) return false;

  const age = calculateAge(dateOfBirth);
  return age < 18;
}

/**
 * Automatically assigns the "Under 18" label to users who are minors
 */
export async function autoLabelUnder18User(userId: string, dateOfBirth: Date | null) {
  try {
    if (!isUserUnder18(dateOfBirth)) {
      // User is 18 or older, remove "Under 18" label if they have it
      const under18Label = await prisma.customLabel.findUnique({
        where: { name: "Under 18" },
      });

      if (under18Label) {
        await prisma.userCustomLabel.deleteMany({
          where: {
            userId,
            labelId: under18Label.id,
          },
        });
      }
      return;
    }

    // User is under 18, ensure they have the label
    const under18Label = await prisma.customLabel.findUnique({
      where: { name: "Under 18" },
    });

    if (!under18Label) {
      console.warn("Under 18 label not found. Make sure to run the seed script.");
      return;
    }

    // Check if user already has this label
    const existingLabel = await prisma.userCustomLabel.findUnique({
      where: {
        userId_labelId: {
          userId,
          labelId: under18Label.id,
        },
      },
    });

    if (!existingLabel) {
      // Assign the label
      await prisma.userCustomLabel.create({
        data: {
          userId,
          labelId: under18Label.id,
        },
      });
    }
  } catch (error) {
    console.error("Error auto-labeling under 18 user:", error);
    // Don't throw - we don't want auto-labeling failures to break user registration
  }
}

/**
 * Automatically assigns the "New Volunteer" label to newly registered users
 */
export async function autoLabelNewVolunteer(userId: string) {
  try {
    const newVolunteerLabel = await prisma.customLabel.findUnique({
      where: { name: "New Volunteer" },
    });

    if (!newVolunteerLabel) {
      console.warn("New Volunteer label not found. Make sure to run the seed script.");
      return;
    }

    // Check if user already has this label
    const existingLabel = await prisma.userCustomLabel.findUnique({
      where: {
        userId_labelId: {
          userId,
          labelId: newVolunteerLabel.id,
        },
      },
    });

    if (!existingLabel) {
      // Assign the label
      await prisma.userCustomLabel.create({
        data: {
          userId,
          labelId: newVolunteerLabel.id,
        },
      });
    }
  } catch (error) {
    console.error("Error auto-labeling new volunteer:", error);
    // Don't throw - we don't want auto-labeling failures to break user registration
  }
}