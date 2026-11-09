import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_CATALOG,
  EMAIL_GROUPS,
  emailsInGroup,
  type EmailKey,
} from "./email-catalog";

/**
 * Keeps the catalog shown at /admin/emails honest. The emails are sent from
 * email-service.ts and services/campaign-monitor.ts; these tests fail when one
 * of them gains, loses or changes a template without the catalog following.
 */

const SRC_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.resolve(SRC_DIR, "..");

const fakeId = (envVar: string) => `id-for-${envVar}`;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "generated" ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Every CAMPAIGN_MONITOR_* template variable the app reads from the environment. */
function templateEnvVarsReadByTheApp(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(
      /process\.env\.(CAMPAIGN_MONITOR_[A-Z0-9_]+)/g
    )) {
      found.add(match[1]);
    }
  }
  // Account settings, not templates.
  found.delete("CAMPAIGN_MONITOR_API_KEY");
  found.delete("CAMPAIGN_MONITOR_APP_URL");
  return [...found].sort();
}

describe("email catalog", () => {
  const catalogEnvVars = EMAIL_CATALOG.map((email) => email.envVar);

  it("lists every Campaign Monitor template the app reads, and no others", () => {
    expect([...catalogEnvVars].sort()).toEqual(templateEnvVarsReadByTheApp());
  });

  it("has unique keys and template variables", () => {
    expect(new Set(EMAIL_CATALOG.map((e) => e.key)).size).toBe(
      EMAIL_CATALOG.length
    );
    expect(new Set(catalogEnvVars).size).toBe(EMAIL_CATALOG.length);
  });

  it("puts every email in exactly one group", () => {
    const grouped = EMAIL_GROUPS.flatMap((group) => emailsInGroup(group.id));
    expect(grouped.map((e) => e.key).sort()).toEqual(
      EMAIL_CATALOG.map((e) => e.key).sort()
    );
  });

  it("points fallbacks at real entries", () => {
    const keys = new Set<string>(EMAIL_CATALOG.map((e) => e.key));
    for (const email of EMAIL_CATALOG) {
      if ("fallbackKey" in email) expect(keys).toContain(email.fallbackKey);
    }
  });

  it("is documented in .env.example", () => {
    const example = readFileSync(path.join(WEB_DIR, ".env.example"), "utf8");
    const documented = new Set(
      [...example.matchAll(/^#?\s*(CAMPAIGN_MONITOR_[A-Z0-9_]+)=/gm)].map(
        (m) => m[1]
      )
    );
    const missing = catalogEnvVars.filter((v) => !documented.has(v));
    expect(missing).toEqual([]);
  });

  it("never uses an em dash in copy shown to admins", () => {
    expect(JSON.stringify([EMAIL_CATALOG, EMAIL_GROUPS])).not.toContain(
      String.fromCharCode(0x2014)
    );
  });
});

describe("emails as actually sent", () => {
  /** One captured call to Campaign Monitor's smart email send endpoint. */
  interface SentEmail {
    templateId: string;
    variables: string[];
  }

  let sent: SentEmail[];

  beforeEach(() => {
    sent = [];
    vi.resetModules();
    vi.stubEnv("CAMPAIGN_MONITOR_API_KEY", "test-api-key");
    for (const email of EMAIL_CATALOG) {
      vi.stubEnv(email.envVar, fakeId(email.envVar));
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const match = String(url).match(/\/smartemail\/([^/]+)\/send$/i);
        if (match && typeof init?.body === "string") {
          const body = JSON.parse(init.body) as { Data: Record<string, unknown> };
          sent.push({
            templateId: match[1],
            variables: Object.keys(body.Data),
          });
        }
        return new Response(JSON.stringify({ MessageID: "test" }), {
          status: 200,
        });
      })
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const shift = {
    to: "vol@example.com",
    volunteerName: "Aroha Smith",
    shiftName: "Kitchen Prep",
    shiftDate: "Saturday 14 November 2026",
    shiftTime: "4:00 pm - 8:00 pm",
    location: "Wellington",
  };

  const managerCancellation = {
    to: "manager@example.com",
    managerName: "Sam Manager",
    volunteerName: "Aroha Smith",
    volunteerEmail: "vol@example.com",
    shiftName: "Kitchen Prep",
    shiftDate: "Saturday 14 November 2026",
    shiftTime: "4:00 pm",
    location: "Wellington",
    cancellationTime: "14 Nov 2026, 9:00 am",
    remainingVolunteers: 3,
    shiftCapacity: 6,
  };

  const confirmation = {
    ...shift,
    shiftId: "shift-1",
    shiftStart: new Date("2026-11-14T03:00:00Z"),
    shiftEnd: new Date("2026-11-14T07:00:00Z"),
  };

  /**
   * How to make the app send each catalogued email. Typed by EmailKey, so a
   * new catalog entry does not compile until it is exercised here.
   */
  const senders: Record<EmailKey, () => Promise<unknown>> = {
    "shift-confirmation": async () =>
      (await service()).sendShiftConfirmationNotification(confirmation),
    "first-shift-confirmation": async () =>
      (await service()).sendShiftConfirmationNotification({
        ...confirmation,
        isFirstShift: true,
      }),
    "volunteer-cancellation": async () =>
      (await service()).sendVolunteerCancellationNotification(shift),
    "volunteer-not-needed": async () =>
      (await service()).sendVolunteerNotNeededNotification(shift),
    "no-show": async () => (await service()).sendNoShowNotification(shift),
    "email-verification": async () =>
      (await service()).sendEmailVerification({
        to: "vol@example.com",
        firstName: "Aroha",
        verificationLink: "https://example.com/verify",
      }),
    "profile-completion": async () =>
      (await service()).sendProfileCompletion({
        to: "vol@example.com",
        firstName: "Aroha",
      }),
    "user-invitation": async () =>
      (await service()).sendUserInvitation({
        to: "vol@example.com",
        firstName: "Aroha",
        lastName: "Smith",
        role: "VOLUNTEER",
        tempPassword: "not-a-real-password",
      }),
    "password-reset": async () => {
      const { campaignMonitorService } = await import(
        "./services/campaign-monitor"
      );
      return campaignMonitorService.sendPasswordResetEmail({
        to: "vol@example.com",
        firstName: "Aroha",
        resetUrl: "https://example.com/reset",
      });
    },
    "parental-consent-approval": async () =>
      (await service()).sendParentalConsentApprovalNotification({
        to: "vol@example.com",
        volunteerName: "Aroha Smith",
      }),
    announcement: async () =>
      (await service()).sendAnnouncement({
        to: "vol@example.com",
        firstName: "Aroha",
        title: "Kia ora",
        bodyHtml: "<p>News</p>",
        feedLink: "https://example.com/feed",
        footerText: "You get these because you volunteer with us.",
      }),
    "shift-shortage": async () =>
      (await service()).sendShiftShortageNotification({
        to: "vol@example.com",
        volunteerName: "Aroha Smith",
        shifts: [
          {
            shiftId: "shift-1",
            shiftName: "Kitchen Prep",
            shiftDate: "Saturday 14 November 2026",
            shiftDateISO: "2026-11-14",
            shiftTime: "4:00 pm",
            location: "Wellington",
            currentVolunteers: 2,
            neededVolunteers: 4,
          },
        ],
      }),
    "survey-notification": async () =>
      (await service()).sendSurveyNotification({
        email: "vol@example.com",
        userName: "Aroha Smith",
        surveyTitle: "How was your shift?",
        surveyUrl: "https://example.com/surveys/token",
      }),
    "first-shift-nudge": async () =>
      (await service()).sendFirstShiftNudge({
        to: "vol@example.com",
        firstName: "Aroha",
        shiftsLink: "https://example.com/shifts",
      }),
    "archive-warning": async () =>
      (await service()).sendArchiveWarning({
        to: "vol@example.com",
        firstName: "Aroha",
        extendLink: "https://example.com/extend",
      }),
    "archived-confirmation": async () =>
      (await service()).sendArchivedConfirmation({
        to: "vol@example.com",
        firstName: "Aroha",
        reactivateLink: "https://example.com/reactivate",
      }),
    "manager-cancellation": async () =>
      (await service()).sendShiftCancellationNotification({
        ...managerCancellation,
        isSameDayCancellation: false,
      }),
    "manager-same-day-cancellation": async () =>
      (await service()).sendShiftCancellationNotification({
        ...managerCancellation,
        isSameDayCancellation: true,
      }),
    "label-assigned": async () =>
      (await service()).sendLabelAssignedNotification({
        to: "admin@example.com",
        recipientName: "Sam Admin",
        volunteerName: "Aroha Smith",
        labelName: "Management Note",
        note: "Please check in",
        assignedBy: "Amy",
        volunteerId: "user-1",
      }),
  };

  /** A fresh service, built after the template IDs above are in the environment. */
  async function service() {
    const { getEmailService } = await import("./email-service");
    return getEmailService();
  }

  it.each(EMAIL_CATALOG.map((email) => [email.name, email] as const))(
    "%s uses its own template and sends the variables the catalog lists",
    async (_name, email) => {
      await senders[email.key]();

      expect(sent).toHaveLength(1);
      expect(sent[0].templateId).toBe(fakeId(email.envVar));
      expect([...sent[0].variables].sort()).toEqual(
        email.variables.map((v) => v.name).sort()
      );
    }
  );
});

describe("getEmailTemplateStatuses", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function clearTemplateEnv() {
    vi.stubEnv("CAMPAIGN_MONITOR_API_KEY", "");
    vi.stubEnv("CAMPAIGN_MONITOR_APP_URL", "");
    for (const email of EMAIL_CATALOG) vi.stubEnv(email.envVar, "");
  }

  async function statuses() {
    const { getEmailTemplateStatuses } = await import("./email-catalog.server");
    const all = await getEmailTemplateStatuses();
    return new Map(all.map((status) => [status.key, status]));
  }

  it("reports which templates are set up without calling Campaign Monitor when there is no API key", async () => {
    clearTemplateEnv();
    vi.stubEnv("CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID", "abc123");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await statuses();

    expect(result.size).toBe(EMAIL_CATALOG.length);
    expect(result.get("no-show")).toEqual({
      key: "no-show",
      configured: true,
      templateId: "abc123",
      campaignMonitorUrl:
        "https://everybodyeats1.createsend.com/triggered/workflow/abc123",
      template: null,
      lookupFailed: false,
    });
    expect(result.get("announcement")).toMatchObject({
      configured: false,
      templateId: null,
      campaignMonitorUrl: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("links to the template in another Campaign Monitor account when one is configured", async () => {
    clearTemplateEnv();
    vi.stubEnv("CAMPAIGN_MONITOR_APP_URL", "https://other.createsend.com/");
    vi.stubEnv("CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID", "abc 123");
    vi.stubGlobal("fetch", vi.fn());

    const result = await statuses();

    expect(result.get("no-show")?.campaignMonitorUrl).toBe(
      "https://other.createsend.com/triggered/workflow/abc%20123"
    );
  });

  it("adds the template's name, subject and preview from Campaign Monitor", async () => {
    clearTemplateEnv();
    vi.stubEnv("CAMPAIGN_MONITOR_API_KEY", "secret-key");
    vi.stubEnv("CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID", "abc123");
    vi.stubEnv("CAMPAIGN_MONITOR_ANNOUNCEMENT_EMAIL_ID", "broken");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) =>
        String(url).endsWith("/abc123")
          ? new Response(
              JSON.stringify({
                SmartEmailID: "abc123",
                Name: "No show",
                Status: "Active",
                Properties: {
                  Subject: "We missed you",
                  HtmlPreviewUrl: "https://preview.example.com/abc123",
                },
              })
            )
          : new Response("Not found", { status: 404 })
      )
    );

    const result = await statuses();

    expect(result.get("no-show")).toMatchObject({
      template: {
        name: "No show",
        subject: "We missed you",
        status: "Active",
        previewUrl: "https://preview.example.com/abc123",
      },
      lookupFailed: false,
    });
    expect(result.get("announcement")).toMatchObject({
      configured: true,
      template: null,
      lookupFailed: true,
    });
    expect(JSON.stringify([...result.values()])).not.toContain("secret-key");
  });
});
