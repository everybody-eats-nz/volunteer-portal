import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import type { User, Shift, Signup, ShiftType, RestaurantManager } from "@prisma/client";

interface ShiftWithDetails extends Shift {
  shiftType: ShiftType;
  signups: Signup[];
}

interface NotificationContext {
  shift: ShiftWithDetails;
  volunteer: User;
  canceledSignup: Signup;
}

export class NotificationService {
  private emailService = getEmailService();

  /**
   * Notify restaurant managers when a volunteer cancels their shift
   */
  async notifyManagersOfShiftCancellation({
    shift,
    volunteer,
    canceledSignup,
  }: NotificationContext): Promise<void> {
    // Skip if shift has no location
    if (!shift.location) {
      console.log("Shift has no location, skipping manager notifications");
      return;
    }

    try {
      // Find restaurant managers for this location
      const managers = await this.getManagersForLocation(shift.location);

      if (managers.length === 0) {
        console.log(`No restaurant managers assigned to location: ${shift.location}`);
        return;
      }

      // Calculate remaining volunteers count
      const remainingVolunteers = shift.signups.filter(
        (signup) => signup.status === "CONFIRMED" && signup.id !== canceledSignup.id
      ).length;

      // Format shift date and time
      const shiftDate = new Intl.DateTimeFormat('en-NZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(shift.start);

      const shiftTime = new Intl.DateTimeFormat('en-NZ', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(shift.start);

      const cancellationTime = new Intl.DateTimeFormat('en-NZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date());

      // Send notifications to all managers
      const notificationPromises = managers.map(async (manager) => {
        try {
          // Send email notification
          await this.emailService.sendShiftCancellationNotification({
            to: manager.user.email,
            managerName: manager.user.firstName || manager.user.name || "Manager",
            volunteerName: volunteer.firstName && volunteer.lastName 
              ? `${volunteer.firstName} ${volunteer.lastName}`
              : volunteer.name || "Volunteer",
            volunteerEmail: volunteer.email,
            shiftName: shift.shiftType.name,
            shiftDate,
            shiftTime,
            location: shift.location!,
            cancellationTime,
            remainingVolunteers,
            shiftCapacity: shift.capacity,
          });

          // Create in-app notification
          await this.createInAppNotification({
            userId: manager.userId,
            shift,
            volunteer,
            remainingVolunteers,
          });

          console.log(`Sent cancellation notification to manager: ${manager.user.email}`);
        } catch (error) {
          console.error(`Failed to notify manager ${manager.user.email}:`, error);
          // Continue with other managers even if one fails
        }
      });

      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.error("Error notifying managers of shift cancellation:", error);
      // Don't throw - notifications shouldn't prevent shift cancellation
    }
  }

  /**
   * Get restaurant managers assigned to a specific location
   */
  private async getManagersForLocation(location: string): Promise<(RestaurantManager & { user: User })[]> {
    return await prisma.restaurantManager.findMany({
      where: {
        locations: { has: location }, // PostgreSQL array contains operator
        receiveNotifications: true,
        user: { role: "ADMIN" }, // Only notify admin users
      },
      include: {
        user: true,
      },
    });
  }

  /**
   * Create in-app notification for restaurant manager
   */
  private async createInAppNotification({
    userId,
    shift,
    volunteer,
    remainingVolunteers,
  }: {
    userId: string;
    shift: ShiftWithDetails;
    volunteer: User;
    remainingVolunteers: number;
  }): Promise<void> {
    const volunteerName = volunteer.firstName && volunteer.lastName 
      ? `${volunteer.firstName} ${volunteer.lastName}`
      : volunteer.name || "A volunteer";

    const shiftDate = new Intl.DateTimeFormat('en-NZ', {
      month: 'short',
      day: 'numeric',
    }).format(shift.start);

    const shiftTime = new Intl.DateTimeFormat('en-NZ', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(shift.start);

    const title = "Volunteer Canceled Shift";
    const message = `${volunteerName} canceled their ${shift.shiftType.name} shift on ${shiftDate} at ${shiftTime} (${shift.location}). ${remainingVolunteers}/${shift.capacity} volunteers remaining.`;

    await prisma.notification.create({
      data: {
        userId,
        type: "SHIFT_CANCELLATION_MANAGER",
        title,
        message,
        actionUrl: `/admin/shifts/${shift.id}`, // Link to shift management page
        relatedId: shift.id,
      },
    });
  }

  /**
   * Get unique locations from existing shifts for admin interface
   */
  async getAvailableLocations(): Promise<string[]> {
    const shifts = await prisma.shift.findMany({
      where: {
        location: { not: null },
      },
      select: {
        location: true,
      },
      distinct: ['location'],
      orderBy: {
        location: 'asc',
      },
    });

    return shifts.map(shift => shift.location!).filter(Boolean);
  }
}

// Export singleton instance
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}