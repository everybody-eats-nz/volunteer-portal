/**
 * Every automated email the portal sends through a Campaign Monitor template,
 * described for the people who look after the templates. The admin page at
 * /admin/emails renders this list.
 *
 * The emails themselves are sent from `email-service.ts` (and the password
 * reset from `services/campaign-monitor.ts`). `email-catalog.test.ts` sends
 * each one against a fake Campaign Monitor and fails when a template the code
 * reads is missing here, or when the variables listed here stop matching what
 * is actually sent - so add the entry here whenever you add an email there.
 *
 * No server-only imports: this file is safe to use from client components.
 */

export interface EmailVariable {
  /** The name the Campaign Monitor template uses, e.g. `firstName`. */
  name: string;
  /** What it holds, in plain English. */
  description: string;
}

export type EmailGroupId =
  | "shifts"
  | "account"
  | "updates"
  | "inactive"
  | "team";

export interface EmailGroup {
  id: EmailGroupId;
  title: string;
  description: string;
}

export const EMAIL_GROUPS: readonly EmailGroup[] = [
  {
    id: "shifts",
    title: "Shifts",
    description: "What a volunteer hears about a shift they applied for.",
  },
  {
    id: "account",
    title: "Joining and accounts",
    description: "Signing up, getting in, and getting back in.",
  },
  {
    id: "updates",
    title: "News and requests",
    description: "Messages the team chooses to send out.",
  },
  {
    id: "inactive",
    title: "Quiet volunteers",
    description: "Sent by the archiving rules to people who have gone quiet.",
  },
  {
    id: "team",
    title: "For the team",
    description: "Alerts to managers and admins, not to volunteers.",
  },
];

export interface EmailCatalogEntry {
  /** Stable id, used in URLs and test ids. */
  key: string;
  name: string;
  group: EmailGroupId;
  /** Who receives it. */
  recipient: string;
  /** What makes the portal send it. */
  trigger: string;
  /** The environment variable holding the Campaign Monitor smart email ID. */
  envVar: `CAMPAIGN_MONITOR_${string}`;
  /** What happens while no template ID is set. */
  ifNotSetUp: string;
  /** The entry whose template is used instead while this one is not set up. */
  fallbackKey?: string;
  /** Anything else worth knowing when editing the template. */
  note?: string;
  variables: readonly EmailVariable[];
}

const firstName: EmailVariable = {
  name: "firstName",
  description: "The volunteer's first name",
};

/** Shared by the three "your shift is off" emails to volunteers. */
const shiftSummaryVariables: readonly EmailVariable[] = [
  firstName,
  { name: "shiftType", description: "The role, e.g. Kitchen Prep" },
  { name: "shiftDate", description: "The date of the shift" },
  { name: "shiftTime", description: "The time of the shift" },
  { name: "location", description: "The restaurant" },
  { name: "browseShiftsLink", description: "Link to the shifts page" },
];

const shiftConfirmationVariables: readonly EmailVariable[] = [
  firstName,
  { name: "role", description: "The role, e.g. Kitchen Prep" },
  { name: "shiftDate", description: "The date of the shift" },
  { name: "shiftTime", description: "The time of the shift" },
  { name: "location", description: "The restaurant" },
  { name: "linkToShift", description: "Link to the shift in the portal" },
  {
    name: "addToGoogleCalendarLink",
    description: "Adds the shift to Google Calendar",
  },
  {
    name: "addToOutlookCalendarLink",
    description: "Adds the shift to Outlook",
  },
  {
    name: "addToCalendarIcsLink",
    description: "Downloads a calendar file for the shift",
  },
  {
    name: "locationMapLink",
    description: "The restaurant on Google Maps",
  },
];

const managerCancellationVariables: readonly EmailVariable[] = [
  { name: "managerName", description: "The manager being told" },
  { name: "volunteerName", description: "Who cancelled" },
  { name: "volunteerEmail", description: "Their email address" },
  { name: "shiftName", description: "The role, e.g. Kitchen Prep" },
  { name: "shiftDate", description: "The date of the shift" },
  { name: "shiftTime", description: "The time of the shift" },
  { name: "location", description: "The restaurant" },
  { name: "cancellationTime", description: "When they cancelled" },
  {
    name: "remainingVolunteers",
    description: "Volunteers still confirmed on the shift",
  },
  { name: "shiftCapacity", description: "Places on the shift" },
  {
    name: "isSameDayCancellation",
    description: '"true" when the shift is today, otherwise "false"',
  },
];

export const EMAIL_CATALOG = [
  // Shifts
  {
    key: "shift-confirmation",
    name: "Shift confirmation",
    group: "shifts",
    recipient: "The volunteer",
    trigger:
      "Their place on a shift is confirmed: approved by the team, approved automatically, or assigned by an admin.",
    envVar: "CAMPAIGN_MONITOR_SHIFT_CONFIRMATION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    note: "A calendar file for the shift is attached automatically.",
    variables: shiftConfirmationVariables,
  },
  {
    key: "first-shift-confirmation",
    name: "First shift confirmation",
    group: "shifts",
    recipient: "The volunteer",
    trigger:
      "Sent in place of the shift confirmation when it is the volunteer's very first shift.",
    envVar: "CAMPAIGN_MONITOR_FIRST_SHIFT_CONFIRMATION_EMAIL_ID",
    ifNotSetUp: "The regular shift confirmation is sent instead.",
    fallbackKey: "shift-confirmation",
    note: "A calendar file for the shift is attached automatically.",
    variables: shiftConfirmationVariables,
  },
  {
    key: "volunteer-cancellation",
    name: "Shift cancelled by the team",
    group: "shifts",
    recipient: "The volunteer",
    trigger: "An admin cancels a place the volunteer had been confirmed for.",
    envVar: "CAMPAIGN_MONITOR_VOLUNTEER_CANCELLATION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: shiftSummaryVariables,
  },
  {
    key: "volunteer-not-needed",
    name: "Not needed for this shift",
    group: "shifts",
    recipient: "The volunteer",
    trigger:
      "An admin declines their application, or takes them off the waitlist. They never held a place, so the wording is gentler than a cancellation.",
    envVar: "CAMPAIGN_MONITOR_VOLUNTEER_NOT_NEEDED_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: shiftSummaryVariables,
  },
  {
    key: "no-show",
    name: "No-show follow-up",
    group: "shifts",
    recipient: "The volunteer",
    trigger:
      "After a shift has finished, if the team marked them as a no-show. Marking them present again before the shift ends stops the email.",
    envVar: "CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID",
    ifNotSetUp:
      "Emails wait in a queue for up to 7 days, then are dropped unsent.",
    variables: shiftSummaryVariables,
  },

  // Joining and accounts
  {
    key: "email-verification",
    name: "Verify your email",
    group: "account",
    recipient: "The person signing up",
    trigger:
      "They register with an email and password, ask for the link again, or an admin resends it from their profile.",
    envVar: "CAMPAIGN_MONITOR_EMAIL_VERIFICATION_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      {
        name: "verificationLink",
        description: "The link that confirms their email address",
      },
    ],
  },
  {
    key: "profile-completion",
    name: "Welcome",
    group: "account",
    recipient: "The new volunteer",
    trigger:
      "They finish signing up: their email is verified, or they complete their profile after joining with Google, Facebook or Apple.",
    envVar: "CAMPAIGN_MONITOR_PROFILE_COMPLETION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      { name: "linkToDashboard", description: "Link to their dashboard" },
    ],
  },
  {
    key: "user-invitation",
    name: "Invitation to the portal",
    group: "account",
    recipient: "The person invited",
    trigger: "An admin invites someone from the Users page.",
    envVar: "CAMPAIGN_MONITOR_USER_INVITATION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      {
        name: "firstName",
        description: "Their first name, or the start of their email address",
      },
      { name: "emailAddress", description: "The email they log in with" },
      { name: "role", description: '"volunteer" or "admin"' },
      { name: "tempPassword", description: "Their temporary password" },
      { name: "loginLink", description: "Link to the login page" },
    ],
  },
  {
    key: "password-reset",
    name: "Reset your password",
    group: "account",
    recipient: "The person who asked",
    trigger: "They use Forgot password on the login page.",
    envVar: "CAMPAIGN_MONITOR_PASSWORD_RESET_TEMPLATE_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      {
        name: "firstName",
        description: 'Their first name, or "there" when we do not know it',
      },
      { name: "resetUrl", description: "The link to choose a new password" },
      {
        name: "expiryHours",
        description: "How long the link works for, in hours (24)",
      },
    ],
  },
  {
    key: "parental-consent-approval",
    name: "Parental consent approved",
    group: "account",
    recipient: "The young volunteer",
    trigger: "An admin approves their parental consent form.",
    envVar: "CAMPAIGN_MONITOR_PARENTAL_CONSENT_APPROVAL_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      { name: "linkToDashboard", description: "Link to their dashboard" },
    ],
  },

  // News and requests
  {
    key: "announcement",
    name: "Announcement",
    group: "updates",
    recipient: "The volunteers the announcement is aimed at",
    trigger:
      "An admin posts an announcement with the email option switched on.",
    envVar: "CAMPAIGN_MONITOR_ANNOUNCEMENT_EMAIL_ID",
    ifNotSetUp: "The announcement still posts in the portal, with no email.",
    note: "The template has to include footerText and preferencesLink for the footer to appear.",
    variables: [
      firstName,
      { name: "title", description: "The announcement's title" },
      { name: "bodyHtml", description: "The announcement itself, formatted" },
      {
        name: "imageUrl",
        description: "The announcement's image, or empty when it has none",
      },
      { name: "feedLink", description: "Link to the announcement in the portal" },
      {
        name: "footerText",
        description: "Why they got this, and whether they can turn it off",
      },
      {
        name: "preferencesLink",
        description: "Link to their notification settings",
      },
    ],
  },
  {
    key: "shift-shortage",
    name: "Shift shortage alert",
    group: "updates",
    recipient: "The volunteers picked on the Shortage Alerts page",
    trigger: "An admin sends a shortage alert for shifts that need more people.",
    envVar: "CAMPAIGN_MONITOR_SHIFT_SHORTAGE_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    note: "shifts is a list: each shift in it has emoji, shiftName, shiftTime, signupLink and spotsNeeded.",
    variables: [
      firstName,
      { name: "shiftCount", description: "How many shifts need people" },
      { name: "shiftDate", description: "The date of the first shift" },
      { name: "location", description: "The restaurant of the first shift" },
      { name: "shifts", description: "The list of shifts that need people" },
      {
        name: "shiftsPageLink",
        description: "Link to the shifts page for that day",
      },
      {
        name: "footerText",
        description: "Why they got this, and that they can turn it off",
      },
      {
        name: "preferencesLink",
        description: "Link to their notification settings",
      },
    ],
  },
  {
    key: "survey-notification",
    name: "Survey invitation",
    group: "updates",
    recipient: "The volunteer",
    trigger:
      "A survey is assigned to them, by an admin or by a survey's automatic trigger.",
    envVar: "CAMPAIGN_MONITOR_SURVEY_NOTIFICATION_EMAIL_ID",
    ifNotSetUp: "The survey still shows in the portal, with no email.",
    variables: [
      firstName,
      { name: "surveyTitle", description: "The name of the survey" },
      { name: "surveyLink", description: "Their personal link to the survey" },
    ],
  },

  // Quiet volunteers
  {
    key: "first-shift-nudge",
    name: "First shift nudge",
    group: "inactive",
    recipient: "The volunteer",
    trigger:
      "They signed up a month ago and have not had a shift confirmed yet.",
    envVar: "CAMPAIGN_MONITOR_FIRST_SHIFT_NUDGE_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      { name: "shiftsLink", description: "Link to the shifts page" },
    ],
  },
  {
    key: "archive-warning",
    name: "Archive warning",
    group: "inactive",
    recipient: "The volunteer",
    trigger:
      "They have not volunteered for 11 months. Their account is archived a month later unless they use the link.",
    envVar: "CAMPAIGN_MONITOR_ARCHIVE_WARNING_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      {
        name: "extendLink",
        description: "The link that keeps their account active",
      },
    ],
  },
  {
    key: "archived-confirmation",
    name: "Account archived",
    group: "inactive",
    recipient: "The volunteer",
    trigger:
      "Meant for the moment an account is archived. The portal does not send this one yet.",
    envVar: "CAMPAIGN_MONITOR_ARCHIVED_CONFIRMATION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: [
      firstName,
      {
        name: "reactivateLink",
        description: "The link that brings their account back",
      },
    ],
  },

  // For the team
  {
    key: "manager-cancellation",
    name: "Volunteer cancelled a shift",
    group: "team",
    recipient: "The managers of that restaurant",
    trigger: "A volunteer cancels their own confirmed shift.",
    envVar: "CAMPAIGN_MONITOR_SHIFT_ADMIN_CANCELLATION_EMAIL_ID",
    ifNotSetUp: "The email is not sent.",
    variables: managerCancellationVariables,
  },
  {
    key: "manager-same-day-cancellation",
    name: "Volunteer cancelled today's shift",
    group: "team",
    recipient: "The managers of that restaurant",
    trigger:
      "Sent in place of the regular cancellation alert when the shift is today.",
    envVar: "CAMPAIGN_MONITOR_SHIFT_ADMIN_SAME_DAY_CANCELLATION_EMAIL_ID",
    ifNotSetUp: "The regular cancellation alert is sent instead.",
    fallbackKey: "manager-cancellation",
    variables: managerCancellationVariables,
  },
  {
    key: "label-assigned",
    name: "Label alert",
    group: "team",
    recipient: "The admins watching that label",
    trigger:
      "A label they watch is added to a volunteer. Watchers are chosen on the Custom Labels page.",
    envVar: "CAMPAIGN_MONITOR_LABEL_ASSIGNED_EMAIL_ID",
    ifNotSetUp:
      "Watchers still get the notification in the portal, with no email.",
    variables: [
      { name: "firstName", description: "The admin being told" },
      { name: "volunteerName", description: "Who the label was added to" },
      { name: "labelName", description: "The label" },
      {
        name: "note",
        description: "The note left with the label, or empty when there is none",
      },
      { name: "assignedBy", description: "Who added the label" },
      {
        name: "profileLink",
        description: "Link to the volunteer's admin profile",
      },
    ],
  },
] as const satisfies readonly EmailCatalogEntry[];

export type EmailKey = (typeof EMAIL_CATALOG)[number]["key"];

/** The catalog entries of one group, in display order. */
export function emailsInGroup(group: EmailGroupId): EmailCatalogEntry[] {
  return EMAIL_CATALOG.filter((email) => email.group === group);
}
