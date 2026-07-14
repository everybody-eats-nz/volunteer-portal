/**
 * Marketing CMS service — read-only client for the Everybody Eats marketing
 * site's Payload CMS REST API (events and journal posts).
 *
 * The CMS lives in the marketing-cms repo (Payload 3 inside Next.js) and
 * exposes public read endpoints at {MARKETING_CMS_URL}/api/<collection>.
 * Set MARKETING_CMS_URL (e.g. https://www.everybodyeats.nz) to enable the
 * integration; when unset, all fetchers return empty lists so the portal
 * works without the CMS.
 *
 * CMS events carry a relationship to the CMS `locations` collection, whose
 * `menuLocationName` field holds the exact portal location name (the same
 * join key the marketing site already uses to pull menus from this portal).
 */

import { isSameDayInNZT } from "@/lib/timezone";

interface CmsMediaSize {
  url?: string | null;
}

interface CmsMedia {
  url?: string | null;
  alt?: string | null;
  sizes?: {
    thumbnail?: CmsMediaSize | null;
    card?: CmsMediaSize | null;
    feature?: CmsMediaSize | null;
    hero?: CmsMediaSize | null;
  } | null;
}

interface CmsLocationDoc {
  name?: string | null;
  menuLocationName?: string | null;
}

interface CmsEventDoc {
  id: number;
  name?: string | null;
  slug?: string | null;
  date?: string | null;
  displayTime?: string | null;
  location?: CmsLocationDoc | number | null;
  image?: CmsMedia | number | null;
  shortDescription?: string | null;
  tickets?: {
    priceLabel?: string | null;
    ticketUrl?: string | null;
  } | null;
  createdAt?: string | null;
}

interface CmsJournalPostDoc {
  id: number;
  title?: string | null;
  slug?: string | null;
  category?: string | null;
  summary?: string | null;
  mainImage?: CmsMedia | number | null;
  author?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
}

export interface CmsEvent {
  id: number;
  slug: string;
  name: string;
  /** Event start as an ISO string. */
  date: string;
  /** Human-readable time range, e.g. "6:30pm - 11pm". */
  displayTime: string | null;
  /** Portal location name (CMS menuLocationName, falling back to the CMS location name). */
  location: string | null;
  /** Absolute image URL, or null when the event has no image. */
  imageUrl: string | null;
  shortDescription: string | null;
  priceLabel: string | null;
  ticketUrl: string | null;
  /** Public marketing site page for the event. */
  url: string;
  /** When the event was published in the CMS (ISO). */
  publishedAt: string;
}

export interface CmsJournalPost {
  id: number;
  slug: string;
  title: string;
  category: string | null;
  summary: string | null;
  imageUrl: string | null;
  author: string | null;
  /** Display/publish date of the post (ISO). */
  publishedAt: string;
  /** Public marketing site page for the post. */
  url: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Test hook — clears the module-level TTL cache. */
export function clearMarketingCmsCache(): void {
  cache.clear();
}

function getCmsBaseUrl(): string | null {
  const raw = process.env.MARKETING_CMS_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function resolveImageUrl(
  baseUrl: string,
  media: CmsMedia | number | null | undefined
): string | null {
  if (!media || typeof media === "number") return null;
  // Prefer the original upload (webp) — the CMS's resized variants are PNGs
  // that are typically larger files than the original.
  const url =
    media.url ?? media.sizes?.card?.url ?? media.sizes?.feature?.url ?? null;
  return url ? absoluteUrl(baseUrl, url) : null;
}

function resolveLocationName(
  location: CmsLocationDoc | number | null | undefined
): string | null {
  if (!location || typeof location === "number") return null;
  const menuName = location.menuLocationName?.trim();
  if (menuName) return menuName;
  const name = location.name?.trim();
  return name || null;
}

function normalizeText(value: string | null | undefined): string | null {
  // CMS blurbs often contain hard line breaks (pasted from posters); collapse
  // all whitespace runs so single-line UI surfaces don't render fragments.
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed : null;
}

async function fetchCollection<TDoc>(
  baseUrl: string,
  collection: string,
  params: Record<string, string>
): Promise<TDoc[]> {
  const search = new URLSearchParams({
    "where[_status][equals]": "published",
    ...params,
  });
  const response = await fetch(
    `${baseUrl}/api/${collection}?${search.toString()}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    }
  );
  if (!response.ok) {
    throw new Error(
      `Marketing CMS request failed: ${collection} ${response.status}`
    );
  }
  const body = (await response.json()) as { docs?: TDoc[] };
  return Array.isArray(body.docs) ? body.docs : [];
}

/**
 * TTL-cached fetch. On upstream failure, serves stale data when available so
 * a CMS blip never blanks the feed; otherwise returns the empty fallback.
 */
async function getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.data as T;
  }
  try {
    const data = await fetcher();
    cache.set(key, { data, fetchedAt: now });
    return data;
  } catch (error) {
    console.error(`Marketing CMS fetch failed (${key}):`, error);
    if (entry) return entry.data as T;
    throw error;
  }
}

function mapEvent(baseUrl: string, doc: CmsEventDoc): CmsEvent | null {
  const slug = normalizeText(doc.slug);
  const name = normalizeText(doc.name);
  const date = normalizeText(doc.date);
  if (!slug || !name || !date || Number.isNaN(new Date(date).getTime())) {
    return null;
  }
  return {
    id: doc.id,
    slug,
    name,
    date,
    displayTime: normalizeText(doc.displayTime),
    location: resolveLocationName(doc.location),
    imageUrl: resolveImageUrl(baseUrl, doc.image),
    shortDescription: normalizeText(doc.shortDescription),
    priceLabel: normalizeText(doc.tickets?.priceLabel),
    ticketUrl: normalizeText(doc.tickets?.ticketUrl),
    url: `${baseUrl}/events/${slug}`,
    publishedAt: doc.createdAt ?? date,
  };
}

function mapJournalPost(
  baseUrl: string,
  doc: CmsJournalPostDoc
): CmsJournalPost | null {
  const slug = normalizeText(doc.slug);
  const title = normalizeText(doc.title);
  if (!slug || !title) return null;
  const publishedAt = doc.publishedAt ?? doc.createdAt;
  if (!publishedAt || Number.isNaN(new Date(publishedAt).getTime())) {
    return null;
  }
  return {
    id: doc.id,
    slug,
    title,
    category: normalizeText(doc.category),
    summary: normalizeText(doc.summary),
    imageUrl: resolveImageUrl(baseUrl, doc.mainImage),
    author: normalizeText(doc.author),
    publishedAt,
    url: `${baseUrl}/journal/${slug}`,
  };
}

/**
 * Published CMS events whose date is today (NZ) or later, soonest first.
 * Returns [] when the CMS is not configured or unreachable with no cached data.
 */
export async function getUpcomingCmsEvents(): Promise<CmsEvent[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];
  try {
    return await getCached("events", async () => {
      // Fetch from the start of the current UTC day; "today in NZ" is always
      // within that window, and callers apply precise NZ-day filtering.
      const from = new Date();
      from.setUTCHours(0, 0, 0, 0);
      from.setUTCDate(from.getUTCDate() - 1);
      const docs = await fetchCollection<CmsEventDoc>(baseUrl, "events", {
        "where[date][greater_than_equal]": from.toISOString(),
        depth: "2",
        sort: "date",
        limit: "50",
      });
      return docs
        .map((doc) => mapEvent(baseUrl, doc))
        .filter((event): event is CmsEvent => event !== null);
    });
  } catch {
    return [];
  }
}

/**
 * Most recently published CMS journal posts, newest first.
 * Returns [] when the CMS is not configured or unreachable with no cached data.
 */
export async function getRecentCmsJournalPosts(): Promise<CmsJournalPost[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];
  try {
    return await getCached("journal-posts", async () => {
      const docs = await fetchCollection<CmsJournalPostDoc>(
        baseUrl,
        "journal-posts",
        {
          depth: "1",
          sort: "-publishedAt",
          limit: "10",
        }
      );
      return docs
        .map((doc) => mapJournalPost(baseUrl, doc))
        .filter((post): post is CmsJournalPost => post !== null);
    });
  } catch {
    return [];
  }
}

/**
 * Published CMS events at the given portal location on the same NZ calendar
 * day as `date`. Matching is by exact portal location name (the CMS
 * `menuLocationName` join key), consistent with the menu integration.
 */
export async function getCmsEventsForShift(
  location: string | null | undefined,
  date: Date
): Promise<CmsEvent[]> {
  const shiftLocation = location?.trim();
  if (!shiftLocation) return [];
  const events = await getUpcomingCmsEvents();
  return events.filter(
    (event) =>
      event.location === shiftLocation && isSameDayInNZT(event.date, date)
  );
}
