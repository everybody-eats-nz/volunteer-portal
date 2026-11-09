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
  /** True when Campaign Monitor was asked about this template and the lookup failed. */
  lookupFailed: boolean;
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

async function lookUpTemplate(
  templateId: string,
  apiKey: string
): Promise<CampaignMonitorTemplate | null> {
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
    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (!data || typeof data !== "object") return null;
    const { Name, Status, Properties } = data as Record<string, unknown>;
    const name = stringOrNull(Name);
    if (!name) return null;
    const properties =
      Properties && typeof Properties === "object"
        ? (Properties as Record<string, unknown>)
        : {};

    return {
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
  } catch {
    return null;
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
      const template =
        templateId && apiKey ? await lookUpTemplate(templateId, apiKey) : null;

      return {
        key: email.key,
        configured: templateId !== null,
        templateId,
        campaignMonitorUrl: templateId
          ? campaignMonitorTemplateUrl(templateId)
          : null,
        template,
        lookupFailed: Boolean(templateId && apiKey && !template),
      };
    })
  );
}
