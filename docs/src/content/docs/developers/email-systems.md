---
title: Email Systems
description: Email integration and notification systems
---

The Volunteer Portal uses **[Campaign Monitor](https://www.campaignmonitor.com/)** as its primary email service provider for sending transactional emails and notifications to volunteers, administrators, and restaurant managers.

## Architecture Overview

The email system consists of several key components:

- **EmailService** (`web/src/lib/email-service.ts`) - Main service for sending emails via Campaign Monitor
- **Email Templates** - Pre-configured [smart email templates](https://help.campaignmonitor.com/smart-email-templates) in Campaign Monitor
- **Notification Service** (`web/src/lib/notification-service.ts`) - Handles email notifications for shift-related events

## Configuration

### Getting Access

Before configuring the email system, ensure you have access to Campaign Monitor and other required services. See the [Developer Access Guide](/developers/developer-access-guide) for complete setup instructions.

### Environment Variables

The email system requires several environment variables to be configured:

```bash
# Campaign Monitor API Configuration (get your API key from https://app.campaignmonitor.com/account/)
CAMPAIGN_MONITOR_API_KEY="your-campaign-monitor-api-key"

# Smart Email Template IDs (create templates at https://app.campaignmonitor.com/transactional/)
CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID="migration-template-id"
CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID="admin-cancellation-template-id"
CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID="shortage-template-id"
CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID="confirmation-template-id"
CAMPAIGN_MONITOR_FIRST_SHIFT_CONFIRMATION_EMAIL_ID="first-shift-confirmation-template-id"
CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID="volunteer-cancellation-template-id"
CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID="email-verification-template-id"
CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID="parental-consent-template-id"
CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID="user-invitation-template-id"

# Base URL for links in emails
NEXTAUTH_URL="https://your-domain.com"
```

### Development Mode

In development, when Campaign Monitor credentials are not configured:

- Emails are logged to the console instead of being sent
- The system gracefully degrades without throwing errors
- This allows local development without requiring Campaign Monitor setup

## Email Types

All email templates are configured as [Campaign Monitor Smart Email Templates](https://help.campaignmonitor.com/s/article/smart-transactional-emails), which allow for dynamic content and personalization.

### 1. Migration Invitation (`CAMPAIGN_MONITOR_MIGRATION_EMAIL_ID`)

Sent to volunteers during data migration from legacy systems.

**Data Fields:**

- `firstName` - Recipient's first name
- `link` - Migration link for account setup

### 2. Shift Confirmation (`CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID`)

Sent when a volunteer successfully signs up for a shift.

**Data Fields:**

- `firstName` - Volunteer's first name
- `role` - Shift role/type name
- `shiftDate` - Formatted date (e.g., "Monday, January 15, 2024")
- `shiftTime` - Time range (e.g., "6:00 PM - 9:00 PM")
- `location` - Restaurant/venue location
- `linkToShift` - Direct link to shift details
- `addToGoogleCalendarLink` - Google Calendar add link
- `addToOutlookCalendarLink` - Outlook Calendar add link
- `addToCalendarIcsLink` - ICS file download link
- `locationMapLink` - Google Maps link to location

### 3. First Shift Confirmation (`CAMPAIGN_MONITOR_FIRST_SHIFT_CONFIRMATION_EMAIL_ID`)

Sent when a volunteer successfully signs up for their very first shift. This special email can include welcome messages, additional instructions, or resources for first-time volunteers.

**Data Fields:**

- `firstName` - Volunteer's first name
- `role` - Shift role/type name
- `shiftDate` - Formatted date (e.g., "Monday, January 15, 2024")
- `shiftTime` - Time range (e.g., "6:00 PM - 9:00 PM")
- `location` - Restaurant/venue location
- `linkToShift` - Direct link to shift details
- `addToGoogleCalendarLink` - Google Calendar add link
- `addToOutlookCalendarLink` - Outlook Calendar add link
- `addToCalendarIcsLink` - ICS file download link
- `locationMapLink` - Google Maps link to location

**Note:** If this template is not configured, the system will automatically fall back to the regular shift confirmation template.

### 4. Shift Cancellation - Manager (`CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID`)

Sent to restaurant managers when a volunteer cancels their shift.

**Data Fields:**

- `managerName` - Manager's name
- `volunteerName` - Name of volunteer who cancelled
- `volunteerEmail` - Volunteer's email address
- `shiftName` - Shift type name
- `shiftDate` - Formatted date
- `shiftTime` - Time range
- `location` - Restaurant location
- `cancellationTime` - When the cancellation occurred
- `remainingVolunteers` - Number of volunteers still assigned
- `shiftCapacity` - Total capacity needed for the shift

### 5. Volunteer Cancellation (`CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID`)

Sent to volunteers confirming their shift cancellation.

**Data Fields:**

- `firstName` - Volunteer's first name
- `shiftType` - Name of the shift type
- `shiftDate` - Formatted date
- `shiftTime` - Time range
- `location` - Restaurant location
- `browseShiftsLink` - Link to browse available shifts

### 6. Shift Shortage (`CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID`)

Sent to eligible volunteers when a shift needs more volunteers.

**Data Fields:**

- `firstName` - Volunteer's first name
- `shiftType` - Name of the shift type
- `shiftDate` - Formatted date
- `restarauntLocation` - Restaurant location
- `linkToEvent` - Direct link to the shift signup

### 7. Email Verification (`CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID`)

Sent to new users to verify their email address.

**Data Fields:**

- `firstName` - User's first name
- `verificationLink` - Link to verify email address

### 8. Parental Consent Approval (`CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID`)

Sent when parental consent is approved for underage volunteers.

**Data Fields:**

- `firstName` - Volunteer's first name
- `linkToDashboard` - Link to volunteer dashboard

### 9. User Invitation (`CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID`)

Sent when administrators invite new users to join the volunteer portal.

**Data Fields:**

- `firstName` - User's first name
- `email` - User's email address
- `invitationUrl` - Link to complete registration
- `organizationName` - Name of the organization (Everybody Eats)

## Usage Examples

### Sending a Shift Confirmation Email

```typescript
import { getEmailService } from "@/lib/email-service";
import { isFirstConfirmedShift } from "@/lib/shift-helpers";

const emailService = getEmailService();

// Check if this is the volunteer's first confirmed shift
const isFirstShift = await isFirstConfirmedShift(volunteer.id, shift.id);

await emailService.sendShiftConfirmationNotification({
  to: volunteer.email,
  volunteerName: `${volunteer.firstName} ${volunteer.lastName}`,
  shiftName: shift.shiftType.name,
  shiftDate: "Monday, January 15, 2024",
  shiftTime: "6:00 PM - 9:00 PM",
  location: shift.location,
  shiftId: shift.id,
  shiftStart: shift.start,
  shiftEnd: shift.end,
  isFirstShift: isFirstShift, // Use special first shift template if true
});
```

### Sending a User Invitation Email

```typescript
import { getEmailService } from "@/lib/email-service";

const emailService = getEmailService();

await emailService.sendUserInvitation({
  to: newUser.email,
  firstName: newUser.firstName,
  email: newUser.email,
  invitationUrl: `${process.env.NEXTAUTH_URL}/register?token=${invitationToken}`,
  organizationName: "Everybody Eats",
});
```

### Sending Shortage Notifications

```typescript
// This is typically called from an admin API route
import { getEmailService } from "@/lib/email-service";

const emailService = getEmailService();

await emailService.sendShiftShortageNotification({
  to: volunteer.email,
  volunteerName: volunteer.name,
  shiftName: shift.shiftType.name,
  shiftDate: "Monday, January 15, 2024",
  shiftTime: "6:00 PM - 9:00 PM",
  location: shift.location,
  currentVolunteers: 2,
  neededVolunteers: 5,
  shiftId: shift.id,
});
```

## Error Handling

The email service implements robust error handling:

1. **Development Mode**: Emails are logged to console instead of sent
2. **Missing Configuration**: Graceful degradation with warning logs
3. **API Failures**: Errors are logged but don't crash the application
4. **Retry Logic**: Not implemented - relies on Campaign Monitor's reliability

### Example Error Handling Pattern

```typescript
try {
  await emailService.sendShiftConfirmationNotification(params);
  console.log("Email sent successfully");
} catch (error) {
  if (process.env.NODE_ENV === "development") {
    console.warn("Email sending failed in development (this is OK):", error);
  } else {
    console.error("Failed to send email:", error);
    // Don't throw - continue with other operations
  }
}
```

## Integration Points

### API Routes

Email sending is integrated into various API routes:

- `/api/admin/notifications/send-shortage` - Sends shortage notifications
- `/api/auth/resend-verification` - Resends email verification
- `/api/admin/users/invite` - Sends user invitations

### Notification Service

The `NotificationService` coordinates email notifications with in-app notifications:

```typescript
// Send both email and in-app notification
await this.emailService.sendShiftCancellationNotification(emailParams);
await this.createInAppNotification(notificationParams);
```

### Calendar Integration

Shift confirmation emails include calendar integration:

- Google Calendar "Add to Calendar" links
- Outlook Calendar integration
- ICS file downloads for other calendar applications

## Best Practices

1. **Always handle email failures gracefully** - Don't let email failures break core functionality
2. **Use meaningful template data** - Provide all required fields for templates
3. **Test in development** - Use console logging to verify email content
4. **Monitor email delivery** - Check [Campaign Monitor analytics](https://www.campaignmonitor.com/resources/guides/reporting/) for delivery rates
5. **Respect user preferences** - Check notification preferences before sending

## Troubleshooting

### Common Issues

For additional help, consult the [Campaign Monitor Help Center](https://help.campaignmonitor.com/) or [API Documentation](https://www.campaignmonitor.com/api/).

**Emails not sending in production:**

- Verify `CAMPAIGN_MONITOR_API_KEY` is set (get from [Account Settings](https://app.campaignmonitor.com/account/))
- Check that all template IDs are configured
- Review [Campaign Monitor dashboard](https://app.campaignmonitor.com/transactional/) for delivery status

**Template errors:**

- Ensure all required data fields are provided
- Verify template IDs match your [Campaign Monitor templates](https://app.campaignmonitor.com/transactional/)
- Check template syntax in the [Campaign Monitor template editor](https://help.campaignmonitor.com/smart-email-templates)

**Development setup:**

- Emails should log to console when credentials aren't configured
- Check server logs for email content
- Verify `NEXTAUTH_URL` is set for correct links

**Link generation issues:**

- Ensure `NEXTAUTH_URL` environment variable is set
- Check that shift IDs and other parameters are valid
- Verify calendar URL generation is working
