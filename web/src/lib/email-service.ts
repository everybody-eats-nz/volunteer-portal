import createsend from "createsend-node";
import { generateCalendarUrls, generateGoogleMapsLink } from "./calendar-utils";

interface EmailData {
  firstName: string;
  link: string;
  [key: string]: string;
}

interface SendEmailParams {
  to: string;
  firstName: string;
  migrationLink: string;
}

interface ShiftCancellationEmailData {
  managerName: string;
  volunteerName: string;
  volunteerEmail: string;
  shiftName: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  cancellationTime: string;
  remainingVolunteers: string;
  shiftCapacity: string;
}

interface SendShiftCancellationParams {
  to: string;
  managerName: string;
  volunteerName: string;
  volunteerEmail: string;
  shiftName: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  cancellationTime: string;
  remainingVolunteers: number;
  shiftCapacity: number;
}

interface ShiftShortageEmailData {
  firstName: string;
  shiftType: string;
  shiftDate: string;
  restarauntLocation: string;
  linkToEvent: string;
}

interface SendShiftShortageParams {
  to: string;
  volunteerName: string;
  shiftName: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  currentVolunteers: number;
  neededVolunteers: number;
  shiftId: string;
}

interface ShiftConfirmationEmailData {
  firstName: string;
  role: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  linkToShift: string;
  addToGoogleCalendarLink: string;
  addToOutlookCalendarLink: string;
  addToCalendarIcsLink: string;
  locationMapLink: string;
}

interface SendShiftConfirmationParams {
  to: string;
  volunteerName: string;
  shiftName: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  shiftId: string;
  shiftStart?: Date;
  shiftEnd?: Date;
}

interface VolunteerCancellationEmailData {
  firstName: string;
  shiftType: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  browseShiftsLink: string;
}

interface SendVolunteerCancellationParams {
  to: string;
  volunteerName: string;
  shiftName: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
}

interface EmailVerificationData {
  firstName: string;
  verificationLink: string;
}

interface SendEmailVerificationParams {
  to: string;
  firstName: string;
  verificationLink: string;
}

interface ParentalConsentApprovalEmailData {
  firstName: string;
  linkToDashboard: string;
}

interface SendParentalConsentApprovalParams {
  to: string;
  volunteerName: string;
}

interface CampaignMonitorAPI {
  transactional: {
    sendSmartEmail: (
      details: unknown,
      callback: (err: Error | null, res: unknown) => void
    ) => void;
  };
}

class EmailService {
  private api: CampaignMonitorAPI;
  private migrationSmartEmailID: string;
  private shiftCancellationAdminSmartEmailID: string;
  private shiftShortageSmartEmailID: string;
  private shiftConfirmationSmartEmailID: string;
  private volunteerCancellationSmartEmailID: string;
  private emailVerificationSmartEmailID: string;
  private parentalConsentApprovalSmartEmailID: string;

  constructor() {
    const apiKey = process.env.CAMPAIGN_MONITOR_API_KEY;
    const isDevelopment = process.env.NODE_ENV === "development";

    if (!apiKey) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_API_KEY is not configured - emails will not be sent"
        );
      } else {
        throw new Error("CAMPAIGN_MONITOR_API_KEY is not configured");
      }
    }

    const auth = { apiKey: apiKey || "dummy-key-for-dev" };
    this.api = new createsend(auth) as CampaignMonitorAPI;

    // Smart email ID for migration invites
    const migrationEmailId = process.env.CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID;
    if (!migrationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID is not configured - migration emails will not be sent"
        );
        this.migrationSmartEmailID = "dummy-migration-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.migrationSmartEmailID = migrationEmailId;
    }

    // Smart email ID for shift cancellation notifications
    const adminNotificationCancellationEmailId =
      process.env.CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID;
    if (!adminNotificationCancellationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID is not configured - cancellation emails will not be sent"
        );
        this.shiftCancellationAdminSmartEmailID = "dummy-cancellation-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.shiftCancellationAdminSmartEmailID =
        adminNotificationCancellationEmailId;
    }

    // Smart email ID for shift shortage notifications
    const shortageEmailId =
      process.env.CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID;
    if (!shortageEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID is not configured - shortage emails will not be sent"
        );
        this.shiftShortageSmartEmailID = "dummy-shortage-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID is not configured"
        );
      }
    } else {
      this.shiftShortageSmartEmailID = shortageEmailId;
    }

    // Smart email ID for shift confirmation notifications
    const confirmationEmailId =
      process.env.CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID;
    if (!confirmationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID is not configured - confirmation emails will not be sent"
        );
        this.shiftConfirmationSmartEmailID = "dummy-confirmation-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.shiftConfirmationSmartEmailID = confirmationEmailId;
    }

    // Smart email ID for volunteer cancellation notifications
    const volunteerCancellationEmailId =
      process.env.CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID;
    if (!volunteerCancellationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID is not configured - volunteer cancellation emails will not be sent"
        );
        this.volunteerCancellationSmartEmailID =
          "dummy-volunteer-cancellation-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.volunteerCancellationSmartEmailID = volunteerCancellationEmailId;
    }

    // Smart email ID for email verification
    const emailVerificationEmailId = process.env.CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID;
    if (!emailVerificationEmailId) {
      if (isDevelopment) {
        console.warn("[EMAIL SERVICE] CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID is not configured - email verification emails will not be sent");
        this.emailVerificationSmartEmailID = 'dummy-email-verification-id';
      } else {
        throw new Error("CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID is not configured");
      }
    } else {
      this.emailVerificationSmartEmailID = emailVerificationEmailId;
    }

    // Smart email ID for parental consent approval notifications
    const parentalConsentApprovalEmailId =
      process.env.CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID;
    if (!parentalConsentApprovalEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID is not configured - parental consent approval emails will not be sent"
        );
        this.parentalConsentApprovalSmartEmailID =
          "dummy-parental-consent-approval-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID is not configured"
        );
      }
    } else {
      this.parentalConsentApprovalSmartEmailID = parentalConsentApprovalEmailId;
    }
  }

  async sendMigrationInvite({
    to,
    firstName,
    migrationLink,
  }: SendEmailParams): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (isDevelopment && this.migrationSmartEmailID === "dummy-migration-id") {
      console.log(
        `[EMAIL SERVICE] Would send migration email to ${to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    const details = {
      smartEmailID: this.migrationSmartEmailID,
      to: `${firstName} <${to}>`,
      data: {
        firstName,
        link: migrationLink,
      } as EmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending migration invite email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending migration invite email:", err);
            reject(err);
          }
        } else {
          console.log("Migration invite email sent successfully to:", to);
          resolve();
        }
      });
    });
  }

  async sendShiftCancellationNotification(
    params: SendShiftCancellationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.shiftCancellationAdminSmartEmailID === "dummy-cancellation-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send cancellation email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    const details = {
      smartEmailID: this.shiftCancellationAdminSmartEmailID,
      to: `${params.managerName} <${params.to}>`,
      data: {
        managerName: params.managerName,
        volunteerName: params.volunteerName,
        volunteerEmail: params.volunteerEmail,
        shiftName: params.shiftName,
        shiftDate: params.shiftDate,
        shiftTime: params.shiftTime,
        location: params.location,
        cancellationTime: params.cancellationTime,
        remainingVolunteers: params.remainingVolunteers.toString(),
        shiftCapacity: params.shiftCapacity.toString(),
      } as ShiftCancellationEmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending shift cancellation email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending shift cancellation email:", err);
            reject(err);
          }
        } else {
          console.log(
            "Shift cancellation email sent successfully to:",
            params.to
          );
          resolve();
        }
      });
    });
  }

  async sendShiftShortageNotification(
    params: SendShiftShortageParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.shiftShortageSmartEmailID === "dummy-shortage-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send shortage email to ${params.to} (skipped in dev - no config)`
      );
      console.log(`[EMAIL SERVICE] Email data:`, {
        firstName: params.volunteerName.split(" ")[0],
        shiftType: params.shiftName,
        shiftDate: `${params.shiftDate} at ${params.shiftTime}`,
        restarauntLocation: params.location,
        linkToEvent: `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/shifts/${params.shiftId}`,
      });
      return Promise.resolve();
    }

    const signupLink = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/shifts/${params.shiftId}`;

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;

    const details = {
      smartEmailID: this.shiftShortageSmartEmailID,
      to: `${params.volunteerName} <${params.to}>`,
      data: {
        firstName: firstName,
        shiftType: params.shiftName,
        shiftDate: `${params.shiftDate} at ${params.shiftTime}`,
        restarauntLocation: params.location,
        linkToEvent: signupLink,
      } as ShiftShortageEmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending shift shortage email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending shift shortage email:", err);
            reject(err);
          }
        } else {
          console.log("Shift shortage email sent successfully to:", params.to);
          console.log("Email data sent:", details.data);
          resolve();
        }
      });
    });
  }

  async sendBulkShortageNotifications(
    shiftParams: Omit<SendShiftShortageParams, "to" | "volunteerName">,
    recipients: Array<{ email: string; name: string }>
  ): Promise<void> {
    const promises = recipients.map((recipient) =>
      this.sendShiftShortageNotification({
        ...shiftParams,
        to: recipient.email,
        volunteerName: recipient.name,
      })
    );

    await Promise.allSettled(promises);
  }

  async sendShiftConfirmationNotification(
    params: SendShiftConfirmationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.shiftConfirmationSmartEmailID === "dummy-confirmation-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send shift confirmation email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    const shiftLink = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/shifts/${params.shiftId}`;

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;

    // Generate calendar and maps links
    const locationMapLink = generateGoogleMapsLink(params.location);

    // Generate all calendar links if we have the start/end dates
    let calendarUrls = { google: "", outlook: "", ics: "" };
    if (params.shiftStart && params.shiftEnd) {
      const shiftData = {
        id: params.shiftId,
        start: params.shiftStart,
        end: params.shiftEnd,
        location: params.location,
        shiftType: {
          name: params.shiftName,
          description: null,
        },
      };
      calendarUrls = generateCalendarUrls(shiftData);
    }

    const details = {
      smartEmailID: this.shiftConfirmationSmartEmailID,
      to: `${params.volunteerName} <${params.to}>`,
      data: {
        firstName: firstName,
        role: params.shiftName,
        shiftDate: params.shiftDate,
        shiftTime: params.shiftTime,
        location: params.location,
        linkToShift: shiftLink,
        addToGoogleCalendarLink: calendarUrls.google,
        addToOutlookCalendarLink: calendarUrls.outlook,
        addToCalendarIcsLink: calendarUrls.ics,
        locationMapLink: locationMapLink,
      } as ShiftConfirmationEmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending shift confirmation email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending shift confirmation email:", err);
            reject(err);
          }
        } else {
          console.log(
            "Shift confirmation email sent successfully to:",
            params.to
          );
          resolve();
        }
      });
    });
  }

  async sendVolunteerCancellationNotification(
    params: SendVolunteerCancellationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.volunteerCancellationSmartEmailID ===
        "dummy-volunteer-cancellation-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send volunteer cancellation email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;
    
    const browseShiftsLink = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/shifts`;

    const details = {
      smartEmailID: this.volunteerCancellationSmartEmailID,
      to: `${params.volunteerName} <${params.to}>`,
      data: {
        firstName: firstName,
        shiftType: params.shiftName,
        shiftDate: params.shiftDate,
        shiftTime: params.shiftTime,
        location: params.location,
        browseShiftsLink: browseShiftsLink,
      } as VolunteerCancellationEmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending volunteer cancellation email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending volunteer cancellation email:", err);
            reject(err);
          }
        } else {
          console.log(
            "Volunteer cancellation email sent successfully to:",
            params.to
          );
          resolve();
        }
      });
    });
  }

  async sendParentalConsentApprovalNotification(
    params: SendParentalConsentApprovalParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.parentalConsentApprovalSmartEmailID ===
        "dummy-parental-consent-approval-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send parental consent approval email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;
    const dashboardLink = `${
      process.env.NEXTAUTH_URL || "http://localhost:3000"
    }/dashboard`;

    const details = {
      smartEmailID: this.parentalConsentApprovalSmartEmailID,
      to: `${params.volunteerName} <${params.to}>`,
      data: {
        firstName: firstName,
        linkToDashboard: dashboardLink,
      } as ParentalConsentApprovalEmailData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn(
              "[EMAIL SERVICE] Error sending parental consent approval email (development):",
              err.message
            );
            resolve(); // Don't fail in development
          } else {
            console.error(
              "Error sending parental consent approval email:",
              err
            );
            reject(err);
          }
        } else {
          console.log(
            "Parental consent approval email sent successfully to:",
            params.to
          );
          resolve();
        }
      });
    });
  }

  async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // In development, skip email sending if configuration is missing
    if (isDevelopment && this.emailVerificationSmartEmailID === 'dummy-email-verification-id') {
      console.log(`[EMAIL SERVICE] Would send email verification to ${params.to} (skipped in dev - no config)`);
      console.log(`[EMAIL SERVICE] Verification link:`, params.verificationLink);
      return Promise.resolve();
    }

    const details = {
      smartEmailID: this.emailVerificationSmartEmailID,
      to: `${params.firstName} <${params.to}>`,
      data: {
        firstName: params.firstName,
        verificationLink: params.verificationLink,
      } as EmailVerificationData,
    };

    return new Promise<void>((resolve, reject) => {
      this.api.transactional.sendSmartEmail(details, (err: Error | null) => {
        if (err) {
          if (isDevelopment) {
            console.warn("[EMAIL SERVICE] Error sending email verification (development):", err.message);
            resolve(); // Don't fail in development
          } else {
            console.error("Error sending email verification:", err);
            reject(err);
          }
        } else {
          console.log("Email verification sent successfully to:", params.to);
          resolve();
        }
      });
    });
  }
}

// Export singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

export type {
  SendEmailParams,
  SendShiftCancellationParams,
  ShiftCancellationEmailData,
  SendShiftShortageParams,
  ShiftShortageEmailData,
  SendShiftConfirmationParams,
  ShiftConfirmationEmailData,
  SendVolunteerCancellationParams,
  VolunteerCancellationEmailData,
  SendEmailVerificationParams,
  EmailVerificationData,
  SendParentalConsentApprovalParams,
  ParentalConsentApprovalEmailData,
};
