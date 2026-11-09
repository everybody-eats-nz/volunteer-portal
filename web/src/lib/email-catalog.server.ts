import { EMAIL_CATALOG, type EmailKey } from "./email-catalog";

const CAMPAIGN_MONITOR_API = "https://api.createsend.com/api/v3.3";

/**
 * Where the team signs in to Campaign Monitor. A template opens at
 * `<this>/triggered/workflow/<smart email ID>`. Override with
 * CAMPAIGN_MONITOR_APP_URL if the account ever moves.
 */
const DEFAULT_CAMPAIGN_MONITOR_APP_URL = "https://everybodyeats1.createsend.com";

/** How long to wait on Campaign Monitor before showing the page without it. */
const LOOKUP_TIMEOUT_MS = 5000;

/** How long an answer from Campaign Monitor is reused before asking again. */
const TEMPLATE_CACHE_MS = 5 * 60 * 1000;

/**
 * "not-found": Campaign Monitor has no template with this ID.
 * "unavailable": it could not be asked (bad API key, outage, timeout).
 */
export type TemplateLookupProblem = "not-found" | "unavailable";

/** What Campaign Monitor says about a template, when we could ask. */
export interface CampaignMonitorTemplate {
  /** The template's name as it appears in Campaign Monitor. */
  name: string;
  subject: string | null;
  /** "Active" or "Draft". */
  status: string | null;
  /** Campaign Monitor's own preview of the template. */
  previewUrl: string | null;
}

export interface EmailTemplateStatus {
  key: EmailKey;
  /** Is a template ID set for this email in this environment? */
  configured: boolean;
  /** The Campaign Monitor smart email ID, when set. Not a secret. */
  templateId: string | null;
  /** The template's page in Campaign Monitor, for whoever edits it. */
  campaignMonitorUrl: string | null;
  /** Details from Campaign Monitor; null when it was not asked or did not answer. */
  template: CampaignMonitorTemplate | null;
  /** Why Campaign Monitor gave no details, when it was asked and did not. */
  lookupProblem: TemplateLookupProblem | null;
}

function httpsUrlOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** The page in Campaign Monitor where a template is edited. */
export function campaignMonitorTemplateUrl(templateId: string): string | null {
  const base = httpsUrlOrNull(
    process.env.CAMPAIGN_MONITOR_APP_URL?.trim() ||
      DEFAULT_CAMPAIGN_MONITOR_APP_URL
  );
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/triggered/workflow/${encodeURIComponent(templateId)}`;
}

type Lookup =
  | { template: CampaignMonitorTemplate; problem: null }
  | { template: null; problem: TemplateLookupProblem };

/**
 * Templates Campaign Monitor has already told us about, by template ID. The
 * page asks about every template on each load, so answers are kept for a few
 * minutes; problems are never kept, so a fixed ID or key shows straight away.
 */
const templateCache = new Map<
  string,
  { template: CampaignMonitorTemplate; expiresAt: number }
>();

async function lookUpTemplate(
  templateId: string,
  apiKey: string
): Promise<Lookup> {
  const cached = templateCache.get(templateId);
  if (cached && cached.expiresAt > Date.now()) {
    return { template: cached.template, problem: null };
  }

  try {
    const response = await fetch(
      `${CAMPAIGN_MONITOR_API}/transactional/smartEmail/${encodeURIComponent(templateId)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      // 400/404: Campaign Monitor does not know this ID. Anything else (a bad
      // API key, rate limiting, an outage) says nothing about the template.
      const notFound = response.status === 400 || response.status === 404;
      console.warn(
        `[EMAIL CATALOG] Campaign Monitor answered ${response.status} for template ${templateId}`
      );
      return { template: null, problem: notFound ? "not-found" : "unavailable" };
    }

    const data: unknown = await response.json();
    const { Name, Status, Properties } =
      data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const name = stringOrNull(Name);
    if (!name) {
      console.warn(
        `[EMAIL CATALOG] Campaign Monitor sent an unexpected answer for template ${templateId}`
      );
      return { template: null, problem: "unavailable" };
    }
    const properties =
      Properties && typeof Properties === "object"
        ? (Properties as Record<string, unknown>)
        : {};

    const template: CampaignMonitorTemplate = {
      name,
      subject: stringOrNull(properties.Subject),
      status: stringOrNull(Status),
      // Campaign Monitor hands back http:// preview links; they work over https.
      previewUrl: httpsUrlOrNull(
        typeof properties.HtmlPreviewUrl === "string"
          ? properties.HtmlPreviewUrl.replace(/^http:/, "https:")
          : null
      ),
    };
    templateCache.set(templateId, {
      template,
      expiresAt: Date.now() + TEMPLATE_CACHE_MS,
    });
    return { template, problem: null };
  } catch (error) {
    console.warn(
      `[EMAIL CATALOG] Could not reach Campaign Monitor for template ${templateId}:`,
      error instanceof Error ? error.message : "unknown error"
    );
    return { template: null, problem: "unavailable" };
  }
}

/**
 * For every email in the catalog: whether its template ID is set here and,
 * when the Campaign Monitor API key is set too, the template's name, subject
 * and preview link from Campaign Monitor. Only template IDs leave this
 * function - never the API key.
 */
export async function getEmailTemplateStatuses(): Promise<
  EmailTemplateStatus[]
> {
  const apiKey = process.env.CAMPAIGN_MONITOR_API_KEY?.trim() || null;

  return Promise.all(
    EMAIL_CATALOG.map(async (email): Promise<EmailTemplateStatus> => {
      const templateId = process.env[email.envVar]?.trim() || null;
      const lookup =
        templateId && apiKey ? await lookUpTemplate(templateId, apiKey) : null;

      return {
        key: email.key,
        configured: templateId !== null,
        templateId,
        campaignMonitorUrl: templateId
          ? campaignMonitorTemplateUrl(templateId)
          : null,
        template: lookup?.template ?? null,
        lookupProblem: lookup?.problem ?? null,
      };
    })
  );
}
