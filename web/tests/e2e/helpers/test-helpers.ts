import { Page, expect } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

/**
 * Create a test user with optional notification preferences
 */
export async function createTestUser(
  email: string,
  role: "ADMIN" | "VOLUNTEER" = "VOLUNTEER",
  additionalData?: {
    availableLocations?: string;
    availableDays?: string;
    receiveShortageNotifications?: boolean;
    excludedShortageNotificationTypes?: string[];
  }
): Promise<void> {
  // Delete existing user first to avoid conflicts
  await prisma.user.deleteMany({
    where: { email }
  });

  const hashedPassword = await hash("Test123456", 12);
  await prisma.user.create({
    data: {
      email,
      hashedPassword,
      role,
      name: `Test User ${email}`,
      firstName: "Test",
      lastName: "User",
      profileCompleted: true,
      ...additionalData,
    },
  });
}

/**
 * Delete test users
 */
export async function deleteTestUsers(emails: string[]): Promise<void> {
  // First get user IDs for the emails
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: emails,
      },
    },
    select: { id: true }
  });
  
  const userIds = users.map(user => user.id);
  
  if (userIds.length > 0) {
    // Delete any remaining signups for these users
    await prisma.signup.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
    
    // Delete any notifications for these users
    await prisma.notification.deleteMany({
      where: {
        userId: {
          in: userIds,
        },
      },
    });
    
    // Finally delete the users
    await prisma.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }
}

/**
 * Login with email and password
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

/**
 * Ensure user has admin role (for test verification)
 */
export async function ensureAdmin(page: Page): Promise<void> {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
}

/**
 * Create a test shift
 */
export async function createShift(data: {
  location: string;
  start: Date;
  end?: Date;
  capacity: number;
  shiftTypeId?: string;
  notes?: string;
}): Promise<{ id: string }> {
  // Get or create a shift type
  let shiftType = await prisma.shiftType.findFirst({
    where: { name: "Kitchen" },
  });
  
  if (!shiftType) {
    try {
      shiftType = await prisma.shiftType.create({
        data: {
          name: "Kitchen",
          description: "Kitchen duties",
        },
      });
    } catch (error) {
      // If creation fails due to unique constraint (another test created it), fetch it again
      shiftType = await prisma.shiftType.findFirst({
        where: { name: "Kitchen" },
      });
      if (!shiftType) {
        throw error; // Re-throw if it's not a unique constraint issue
      }
    }
  }

  const shift = await prisma.shift.create({
    data: {
      shiftTypeId: data.shiftTypeId || shiftType.id,
      location: data.location,
      start: data.start,
      end: data.end || new Date(data.start.getTime() + 3 * 60 * 60 * 1000), // 3 hours later or provided end time
      capacity: data.capacity,
      notes: data.notes || "Test shift",
    },
  });

  return { id: shift.id };
}

/**
 * Delete test shifts
 */
export async function deleteTestShifts(shiftIds: string[]): Promise<void> {
  if (shiftIds.length === 0) return;

  // First delete all signups for these shifts
  await prisma.signup.deleteMany({
    where: {
      shiftId: {
        in: shiftIds,
      },
    },
  });

  // Delete any group bookings for these shifts
  await prisma.groupBooking.deleteMany({
    where: {
      shiftId: {
        in: shiftIds,
      },
    },
  });

  // Then delete the shifts
  await prisma.shift.deleteMany({
    where: {
      id: {
        in: shiftIds,
      },
    },
  });
}

/**
 * Create a notification group
 */
export async function createNotificationGroup(data: {
  name: string;
  description?: string;
  filters: Prisma.InputJsonValue;
  createdBy: string;
}): Promise<{ id: string }> {
  const group = await prisma.notificationGroup.create({
    data: {
      name: data.name,
      description: data.description,
      filters: data.filters,
      createdBy: data.createdBy,
      isActive: true,
    },
  });

  return { id: group.id };
}

/**
 * Delete notification groups
 */
export async function deleteNotificationGroups(names: string[]): Promise<void> {
  await prisma.notificationGroup.deleteMany({
    where: {
      name: {
        in: names,
      },
    },
  });
}