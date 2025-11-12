import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/utils";

/**
 * Checks if a user is under 16 years old based on their date of birth
 */
export function isUserUnder16(dateOfBirth: Date | null): boolean {
  if (!dateOfBirth) return false;

  const age = calculateAge(dateOfBirth);
  return age < 16;
}

/**
 * Automatically assigns the "Under 16" label to users who are minors
 */
export async function autoLabelUnder16User(userId: string, dateOfBirth: Date | null) {
  try {
    if (!isUserUnder16(dateOfBirth)) {
      // User is 16 or older, remove "Under 16" label if they have it
      const under16Label = await prisma.customLabel.findUnique({
        where: { name: "Under 16" },
      });

      if (under16Label) {
        await prisma.userCustomLabel.deleteMany({
          where: {
            userId,
            labelId: under16Label.id,
          },
        });
      }
      return;
    }

    // User is under 16, ensure they have the label
    const under16Label = await prisma.customLabel.findUnique({
      where: { name: "Under 16" },
    });

    if (!under16Label) {
      console.warn("Under 16 label not found. Make sure to run the seed script.");
      return;
    }

    // Check if user already has this label
    const existingLabel = await prisma.userCustomLabel.findUnique({
      where: {
        userId_labelId: {
          userId,
          labelId: under16Label.id,
        },
      },
    });

    if (!existingLabel) {
      // Assign the label
      await prisma.userCustomLabel.create({
        data: {
          userId,
          labelId: under16Label.id,
        },
      });
    }
  } catch (error) {
    console.error("Error auto-labeling under 16 user:", error);
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