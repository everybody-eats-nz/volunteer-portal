import { generateGoogleMapsLink, generateCalendarData } from "./calendar-utils";
import { getBaseUrl } from "./utils";

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
  isSameDayCancellation: string;
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
  isSameDayCancellation: boolean;
}

interface ShiftShortageEmailData extends Record<string, string> {
  firstName: string;
  shiftCount: string;
  shiftList: string; // Pre-rendered plain text list of shifts
  shiftsPageLink: string;
}

interface ShiftForShortageEmail {
  shiftId: string;
  shiftName: string;
  shiftDate: string; // Formatted date for display (e.g., "Saturday, February 8, 2026")
  shiftDateISO: string; // ISO date for URL (e.g., "2026-02-08")
  shiftTime: string;
  location: string;
  currentVolunteers: number;
  neededVolunteers: number;
}

interface SendShiftShortageParams {
  to: string;
  volunteerName: string;
  shifts: ShiftForShortageEmail[];
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

interface VolunteerNotNeededEmailData {
  firstName: string;
  shiftType: string;
  shiftDate: string;
  shiftTime: string;
  location: string;
  browseShiftsLink: string;
}

interface SendVolunteerNotNeededParams {
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

interface UserInvitationEmailData {
  firstName: string;
  emailAddress: string;
  role: string;
  tempPassword: string;
  loginLink: string;
}

interface SendUserInvitationParams {
  to: string;
  firstName?: string;
  lastName?: string;
  role: "VOLUNTEER" | "ADMIN";
  tempPassword: string;
}

interface ProfileCompletionEmailData {
  firstName: string;
  linkToDashboard: string;
}

interface SendProfileCompletionParams {
  to: string;
  firstName: string;
}

interface SurveyNotificationEmailData {
  firstName: string;
  surveyTitle: string;
  surveyLink: string;
}

interface SendSurveyNotificationParams {
  email: string;
  userName: string;
  surveyTitle: string;
  surveyUrl: string;
}

interface EmailAttachment {
  Content: string; // Base64 encoded content
  Name: string; // Filename
  Type: string; // MIME type
}

class EmailService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.createsend.com/api/v3.3";
  private migrationSmartEmailID: string;
  private shiftCancellationAdminSmartEmailID: string;
  private shiftCancellationAdminSameDaySmartEmailID: string;
  private shiftShortageSmartEmailID: string;
  private shiftConfirmationSmartEmailID: string;
  private volunteerCancellationSmartEmailID: string;
  private volunteerNotNeededSmartEmailID: string;
  private emailVerificationSmartEmailID: string;
  private parentalConsentApprovalSmartEmailID: string;
  private userInvitationSmartEmailID: string;
  private profileCompletionSmartEmailID: string;
  private surveyNotificationSmartEmailID: string;

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

    this.apiKey = apiKey || "dummy-key-for-dev";

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

    // Smart email ID for same-day shift cancellation notifications (urgent)
    const sameDayCancellationEmailId =
      process.env.CAMPAIGN_MONITOR_SHIFT_ADMIN_SAME_DAY_CANCELLATION_EMAIL_ID;
    if (!sameDayCancellationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SHIFT_ADMIN_SAME_DAY_CANCELLATION_EMAIL_ID is not configured - same-day cancellation emails will use regular template"
        );
        this.shiftCancellationAdminSameDaySmartEmailID =
          "dummy-same-day-cancellation-id";
      } else {
        // Fall back to regular cancellation email in production if not configured
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SHIFT_ADMIN_SAME_DAY_CANCELLATION_EMAIL_ID is not configured - using regular cancellation template"
        );
        this.shiftCancellationAdminSameDaySmartEmailID =
          adminNotificationCancellationEmailId || "dummy-same-day-cancellation-id";
      }
    } else {
      this.shiftCancellationAdminSameDaySmartEmailID = sameDayCancellationEmailId;
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

    // Smart email ID for volunteer not needed notifications
    const volunteerNotNeededEmailId =
      process.env.CAMPAIGN_MONITOR_VOLUNTEER_NOT_NEEDED_EMAIL_ID;
    if (!volunteerNotNeededEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_VOLUNTEER_NOT_NEEDED_EMAIL_ID is not configured - volunteer not needed emails will not be sent"
        );
        this.volunteerNotNeededSmartEmailID = "dummy-volunteer-not-needed-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_VOLUNTEER_NOT_NEEDED_EMAIL_ID is not configured"
        );
      }
    } else {
      this.volunteerNotNeededSmartEmailID = volunteerNotNeededEmailId;
    }

    // Smart email ID for email verification
    const emailVerificationEmailId =
      process.env.CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID;
    if (!emailVerificationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID is not configured - email verification emails will not be sent"
        );
        this.emailVerificationSmartEmailID = "dummy-email-verification-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID is not configured"
        );
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

    // Smart email ID for user invitation notifications
    const userInvitationEmailId =
      process.env.CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID;
    if (!userInvitationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID is not configured - user invitation emails will not be sent"
        );
        this.userInvitationSmartEmailID = "dummy-user-invitation-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.userInvitationSmartEmailID = userInvitationEmailId;
    }

    // Smart email ID for profile completion notifications
    const profileCompletionEmailId =
      process.env.CAMPAIGN_MONITOR_PROFILE_COMPLETION_EMAIL_ID;
    if (!profileCompletionEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_PROFILE_COMPLETION_EMAIL_ID is not configured - profile completion emails will not be sent"
        );
        this.profileCompletionSmartEmailID = "dummy-profile-completion-id";
      } else {
        throw new Error(
          "CAMPAIGN_MONITOR_PROFILE_COMPLETION_EMAIL_ID is not configured"
        );
      }
    } else {
      this.profileCompletionSmartEmailID = profileCompletionEmailId;
    }

    // Smart email ID for survey notifications
    const surveyNotificationEmailId =
      process.env.CAMPAIGN_MONITOR_SURVEY_NOTIFICATION_EMAIL_ID;
    if (!surveyNotificationEmailId) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SURVEY_NOTIFICATION_EMAIL_ID is not configured - survey notification emails will not be sent"
        );
        this.surveyNotificationSmartEmailID = "dummy-survey-notification-id";
      } else {
        // Survey emails are optional, so just warn in production
        console.warn(
          "[EMAIL SERVICE] CAMPAIGN_MONITOR_SURVEY_NOTIFICATION_EMAIL_ID is not configured - survey notification emails will not be sent"
        );
        this.surveyNotificationSmartEmailID = "dummy-survey-notification-id";
      }
    } else {
      this.surveyNotificationSmartEmailID = surveyNotificationEmailId;
    }
  }

  /**
   * Helper method to send email via Campaign Monitor API
   */
  private async sendSmartEmail(
    smartEmailID: string,
    to: string,
    data: Record<string, string>,
    attachments?: EmailAttachment[]
  ): Promise<void> {
    const emailData: {
      To: string;
      Data: Record<string, string>;
      ConsentToTrack: string;
      AddRecipientsToList: boolean;
      Attachments?: EmailAttachment[];
    } = {
      To: to,
      Data: data,
      ConsentToTrack: "Yes",
      AddRecipientsToList: false,
    };

    if (attachments && attachments.length > 0) {
      emailData.Attachments = attachments;
    }

    const response = await fetch(
      `${this.baseUrl}/transactional/smartemail/${smartEmailID}/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:x`).toString(
            "base64"
          )}`,
        },
        body: JSON.stringify(emailData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Campaign Monitor API error: ${response.status} - ${errorText}`
      );
    }

    return response.json();
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

    try {
      await this.sendSmartEmail(
        this.migrationSmartEmailID,
        `${firstName} <${to}>`,
        {
          firstName,
          link: migrationLink,
        }
      );
      console.log("Migration invite email sent successfully to:", to);
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending migration invite email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending migration invite email:", err);
        throw err;
      }
    }
  }

  async sendShiftCancellationNotification(
    params: SendShiftCancellationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // Select template based on whether this is a same-day cancellation
    const templateId = params.isSameDayCancellation
      ? this.shiftCancellationAdminSameDaySmartEmailID
      : this.shiftCancellationAdminSmartEmailID;

    const templateType = params.isSameDayCancellation
      ? "same-day cancellation"
      : "cancellation";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      (templateId === "dummy-cancellation-id" ||
        templateId === "dummy-same-day-cancellation-id")
    ) {
      console.log(
        `[EMAIL SERVICE] Would send ${templateType} email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    try {
      await this.sendSmartEmail(
        templateId,
        `${params.managerName} <${params.to}>`,
        {
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
          isSameDayCancellation: params.isSameDayCancellation ? "true" : "false",
        }
      );
      console.log(
        `Shift ${templateType} email sent successfully to: ${params.to}`
      );
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending shift cancellation email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending shift cancellation email:", err);
        throw err;
      }
    }
  }

  async sendShiftShortageNotification(
    params: SendShiftShortageParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;

    // Build plain text list of shifts (Campaign Monitor doesn't support HTML in variables)
    const shiftList = params.shifts
      .map((shift, index) => {
        const signupLink = `${getBaseUrl()}/shifts/${shift.shiftId}`;
        return `${index + 1}. ${shift.shiftName}
   ${shift.shiftDate}
   ${shift.shiftTime}
   ${shift.location}
   Sign up: ${signupLink}`;
      })
      .join("\n\n");

    // Build shifts page link with date and location from first shift
    const firstShift = params.shifts[0];
    const shiftsPageLink = `${getBaseUrl()}/shifts/details?date=${firstShift.shiftDateISO}&location=${encodeURIComponent(firstShift.location)}`;

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.shiftShortageSmartEmailID === "dummy-shortage-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send shortage email to ${params.to} (skipped in dev - no config)`
      );
      console.log(`[EMAIL SERVICE] Email data:`, {
        firstName,
        shiftCount: String(params.shifts.length),
        shiftList,
        shiftsPageLink,
      });
      return Promise.resolve();
    }

    const emailData: ShiftShortageEmailData = {
      firstName,
      shiftCount: String(params.shifts.length),
      shiftList,
      shiftsPageLink,
    };

    try {
      await this.sendSmartEmail(
        this.shiftShortageSmartEmailID,
        `${params.volunteerName} <${params.to}>`,
        emailData
      );
      console.log("Shift shortage email sent successfully to:", params.to);
      console.log("Email data sent:", {
        firstName,
        shiftCount: params.shifts.length,
        shiftsIncluded: params.shifts.map((s) => s.shiftName),
      });
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending shift shortage email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending shift shortage email:", err);
        throw err;
      }
    }
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

    const shiftLink = `${getBaseUrl()}/shifts/${params.shiftId}`;

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;

    // Generate calendar and maps links
    const locationMapLink = generateGoogleMapsLink(params.location);

    // Generate calendar data and ICS attachment if we have the start/end dates
    let calendarData = { google: "", outlook: "", icsContent: "" };
    let icsDownloadLink = "";
    const attachments: EmailAttachment[] = [];

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
      calendarData = generateCalendarData(shiftData);

      // Generate public ICS download link
      icsDownloadLink = `${getBaseUrl()}/api/shifts/${params.shiftId}/calendar`;

      // Create ICS file attachment
      const icsContent = Buffer.from(calendarData.icsContent).toString(
        "base64"
      );
      attachments.push({
        Content: icsContent,
        Name: "shift-calendar.ics",
        Type: "text/calendar",
      });
    }

    try {
      await this.sendSmartEmail(
        this.shiftConfirmationSmartEmailID,
        `${params.volunteerName} <${params.to}>`,
        {
          firstName: firstName,
          role: params.shiftName,
          shiftDate: params.shiftDate,
          shiftTime: params.shiftTime,
          location: params.location,
          linkToShift: shiftLink,
          addToGoogleCalendarLink: calendarData.google,
          addToOutlookCalendarLink: calendarData.outlook,
          addToCalendarIcsLink: icsDownloadLink,
          locationMapLink: locationMapLink,
        },
        attachments.length > 0 ? attachments : undefined
      );
      console.log("Shift confirmation email sent successfully to:", params.to);
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending shift confirmation email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending shift confirmation email:", err);
        throw err;
      }
    }
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

    const browseShiftsLink = `${getBaseUrl()}/shifts`;

    try {
      await this.sendSmartEmail(
        this.volunteerCancellationSmartEmailID,
        `${params.volunteerName} <${params.to}>`,
        {
          firstName: firstName,
          shiftType: params.shiftName,
          shiftDate: params.shiftDate,
          shiftTime: params.shiftTime,
          location: params.location,
          browseShiftsLink: browseShiftsLink,
        }
      );
      console.log(
        "Volunteer cancellation email sent successfully to:",
        params.to
      );
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending volunteer cancellation email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending volunteer cancellation email:", err);
        throw err;
      }
    }
  }

  async sendVolunteerNotNeededNotification(
    params: SendVolunteerNotNeededParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.volunteerNotNeededSmartEmailID === "dummy-volunteer-not-needed-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send volunteer not needed email to ${params.to} (skipped in dev - no config)`
      );
      return Promise.resolve();
    }

    // Extract first name from volunteer name
    const firstName =
      params.volunteerName.split(" ")[0] || params.volunteerName;

    const browseShiftsLink = `${getBaseUrl()}/shifts`;

    try {
      await this.sendSmartEmail(
        this.volunteerNotNeededSmartEmailID,
        `${params.volunteerName} <${params.to}>`,
        {
          firstName: firstName,
          shiftType: params.shiftName,
          shiftDate: params.shiftDate,
          shiftTime: params.shiftTime,
          location: params.location,
          browseShiftsLink: browseShiftsLink,
        }
      );
      console.log(
        "Volunteer not needed email sent successfully to:",
        params.to
      );
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending volunteer not needed email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending volunteer not needed email:", err);
        throw err;
      }
    }
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
    const dashboardLink = `${getBaseUrl()}/dashboard`;

    try {
      await this.sendSmartEmail(
        this.parentalConsentApprovalSmartEmailID,
        `${params.volunteerName} <${params.to}>`,
        {
          firstName: firstName,
          linkToDashboard: dashboardLink,
        }
      );
      console.log(
        "Parental consent approval email sent successfully to:",
        params.to
      );
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending parental consent approval email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending parental consent approval email:", err);
        throw err;
      }
    }
  }

  async sendEmailVerification(
    params: SendEmailVerificationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.emailVerificationSmartEmailID === "dummy-email-verification-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send email verification to ${params.to} (skipped in dev - no config)`
      );
      console.log(
        `[EMAIL SERVICE] Verification link:`,
        params.verificationLink
      );
      return Promise.resolve();
    }

    try {
      await this.sendSmartEmail(
        this.emailVerificationSmartEmailID,
        `${params.firstName} <${params.to}>`,
        {
          firstName: params.firstName,
          verificationLink: params.verificationLink,
        }
      );
      console.log("Email verification sent successfully to:", params.to);
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending email verification (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending email verification:", err);
        throw err;
      }
    }
  }

  async sendUserInvitation(params: SendUserInvitationParams): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.userInvitationSmartEmailID === "dummy-user-invitation-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send user invitation email to ${params.to} (skipped in dev - no config)`
      );
      console.log(`[EMAIL SERVICE] Email data:`, {
        firstName: params.firstName || "User",
        role: params.role.toLowerCase(),
        tempPassword: params.tempPassword,
        loginLink: `${getBaseUrl()}/login`,
      });
      return Promise.resolve();
    }

    // Extract first name
    const firstName =
      params.firstName ||
      (params.lastName ? params.lastName : params.to.split("@")[0]);

    const loginLink = `${getBaseUrl()}/login`;

    try {
      await this.sendSmartEmail(
        this.userInvitationSmartEmailID,
        params.firstName && params.lastName
          ? `${params.firstName} ${params.lastName} <${params.to}>`
          : `${firstName} <${params.to}>`,
        {
          firstName: firstName,
          emailAddress: params.to,
          role: params.role.toLowerCase(),
          tempPassword: params.tempPassword,
          loginLink: loginLink,
        }
      );
      console.log("User invitation email sent successfully to:", params.to);
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending user invitation email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending user invitation email:", err);
        throw err;
      }
    }
  }

  async sendProfileCompletion(
    params: SendProfileCompletionParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development, skip email sending if configuration is missing
    if (
      isDevelopment &&
      this.profileCompletionSmartEmailID === "dummy-profile-completion-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send profile completion email to ${params.to} (skipped in dev - no config)`
      );
      console.log(`[EMAIL SERVICE] Email data:`, {
        firstName: params.firstName,
        linkToDashboard: `${getBaseUrl()}/dashboard`,
      });
      return Promise.resolve();
    }

    const dashboardLink = `${getBaseUrl()}/dashboard`;

    try {
      await this.sendSmartEmail(
        this.profileCompletionSmartEmailID,
        `${params.firstName} <${params.to}>`,
        {
          firstName: params.firstName,
          linkToDashboard: dashboardLink,
        }
      );
      console.log("Profile completion email sent successfully to:", params.to);
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending profile completion email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending profile completion email:", err);
        throw err;
      }
    }
  }

  async sendSurveyNotification(
    params: SendSurveyNotificationParams
  ): Promise<void> {
    const isDevelopment = process.env.NODE_ENV === "development";

    // Skip email sending if configuration is missing
    if (
      this.surveyNotificationSmartEmailID === "dummy-survey-notification-id"
    ) {
      console.log(
        `[EMAIL SERVICE] Would send survey notification email to ${params.email} (skipped - no config)`
      );
      console.log(`[EMAIL SERVICE] Email data:`, {
        firstName: params.userName.split(" ")[0],
        surveyTitle: params.surveyTitle,
        surveyLink: params.surveyUrl,
      });
      return Promise.resolve();
    }

    // Extract first name from user name
    const firstName = params.userName.split(" ")[0] || params.userName;

    try {
      await this.sendSmartEmail(
        this.surveyNotificationSmartEmailID,
        `${params.userName} <${params.email}>`,
        {
          firstName: firstName,
          surveyTitle: params.surveyTitle,
          surveyLink: params.surveyUrl,
        }
      );
      console.log(
        "Survey notification email sent successfully to:",
        params.email
      );
    } catch (err) {
      if (isDevelopment) {
        console.warn(
          "[EMAIL SERVICE] Error sending survey notification email (development):",
          err instanceof Error ? err.message : "Unknown error"
        );
        // Don't fail in development
      } else {
        console.error("Error sending survey notification email:", err);
        throw err;
      }
    }
  }

  /**
   * Get email template ID by type
   */
  private getSmartEmailIdByType(
    emailType:
      | "shortage"
      | "cancellation"
      | "sameDayCancellation"
      | "confirmation"
      | "volunteerCancellation"
      | "volunteerNotNeeded"
      | "emailVerification"
      | "parentalConsentApproval"
      | "userInvitation"
      | "profileCompletion"
      | "surveyNotification"
      | "migration"
  ): { id: string; name: string } {
    const emailTemplates = {
      shortage: {
        id: this.shiftShortageSmartEmailID,
        name: "Shift Shortage Notification",
      },
      cancellation: {
        id: this.shiftCancellationAdminSmartEmailID,
        name: "Shift Cancellation (Admin)",
      },
      sameDayCancellation: {
        id: this.shiftCancellationAdminSameDaySmartEmailID,
        name: "Same-Day Shift Cancellation (Admin)",
      },
      confirmation: {
        id: this.shiftConfirmationSmartEmailID,
        name: "Shift Confirmation",
      },
      volunteerCancellation: {
        id: this.volunteerCancellationSmartEmailID,
        name: "Volunteer Cancellation",
      },
      volunteerNotNeeded: {
        id: this.volunteerNotNeededSmartEmailID,
        name: "Volunteer Not Needed",
      },
      emailVerification: {
        id: this.emailVerificationSmartEmailID,
        name: "Email Verification",
      },
      parentalConsentApproval: {
        id: this.parentalConsentApprovalSmartEmailID,
        name: "Parental Consent Approval",
      },
      userInvitation: {
        id: this.userInvitationSmartEmailID,
        name: "User Invitation",
      },
      profileCompletion: {
        id: this.profileCompletionSmartEmailID,
        name: "Profile Completion",
      },
      surveyNotification: {
        id: this.surveyNotificationSmartEmailID,
        name: "Survey Notification",
      },
      migration: { id: this.migrationSmartEmailID, name: "Migration Invite" },
    };

    return emailTemplates[emailType];
  }

  /**
   * Get email template details for preview (generic)
   */
  async getEmailPreview(
    emailType:
      | "shortage"
      | "cancellation"
      | "sameDayCancellation"
      | "confirmation"
      | "volunteerCancellation"
      | "volunteerNotNeeded"
      | "emailVerification"
      | "parentalConsentApproval"
      | "userInvitation"
      | "profileCompletion"
      | "surveyNotification"
      | "migration"
  ): Promise<{
    success: boolean;
    data?: {
      SmartEmailID: string;
      Name: string;
      CreatedAt: string;
      Status: string;
      Properties: {
        From: string;
        ReplyTo: string;
        Subject: string;
        TextPreviewUrl?: string;
        HtmlPreviewUrl?: string;
      };
    };
    message: string;
  }> {
    const isDevelopment = process.env.NODE_ENV === "development";
    const template = this.getSmartEmailIdByType(emailType);

    // In development, return mock data if configuration is missing
    if (isDevelopment && template.id.startsWith("dummy-")) {
      console.log(
        `[EMAIL SERVICE] Would fetch ${emailType} email preview (skipped in dev - no config)`
      );
      return {
        success: true,
        data: {
          SmartEmailID: template.id,
          Name: `${template.name} (Development)`,
          CreatedAt: new Date().toISOString(),
          Status: "Active",
          Properties: {
            From: "noreply@example.com",
            ReplyTo: "noreply@example.com",
            Subject: `${template.name} Subject`,
            TextPreviewUrl: "https://example.com/preview/text",
            HtmlPreviewUrl: "https://example.com/preview/html",
          },
        },
        message: "Development mode: Mock email preview returned",
      };
    }

    try {
      // Make direct API call to get smart email details
      const response = await fetch(
        `${this.baseUrl}/transactional/smartEmail/${template.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:x`).toString(
              "base64"
            )}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Campaign Monitor API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();
      return {
        success: true,
        data,
        message: "Email preview retrieved successfully",
      };
    } catch (err) {
      console.error(`Error fetching ${emailType} email preview:`, err);
      return {
        success: false,
        message: `Failed to fetch email preview: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
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

/**
 * Helper function to send survey notification email
 */
export async function sendSurveyNotification(
  params: SendSurveyNotificationParams
): Promise<void> {
  const service = getEmailService();
  return service.sendSurveyNotification(params);
}

export type {
  SendEmailParams,
  SendShiftCancellationParams,
  ShiftCancellationEmailData,
  SendShiftShortageParams,
  ShiftShortageEmailData,
  ShiftForShortageEmail,
  SendShiftConfirmationParams,
  ShiftConfirmationEmailData,
  SendVolunteerCancellationParams,
  VolunteerCancellationEmailData,
  SendVolunteerNotNeededParams,
  VolunteerNotNeededEmailData,
  SendEmailVerificationParams,
  EmailVerificationData,
  SendParentalConsentApprovalParams,
  ParentalConsentApprovalEmailData,
  SendUserInvitationParams,
  UserInvitationEmailData,
  SendProfileCompletionParams,
  ProfileCompletionEmailData,
  SendSurveyNotificationParams,
  SurveyNotificationEmailData,
};
