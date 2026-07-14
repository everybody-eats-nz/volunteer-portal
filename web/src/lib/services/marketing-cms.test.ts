import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clearMarketingCmsCache,
  getCmsEventsForShift,
  getRecentCmsJournalPosts,
  getUpcomingCmsEvents,
} from "./marketing-cms";

const BASE_URL = "https://cms.test";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

const eventDoc = {
  id: 62,
  name: "Wine Dinner",
  slug: "wine-dinner-29-august",
  date: "2026-08-29T06:00:00.000Z",
  displayTime: "6 - 9pm",
  location: {
    name: "Everybody Eats Onehunga",
    menuLocationName: "Onehunga",
  },
  image: {
    url: "/api/media/file/wine.webp",
    sizes: { card: { url: "/api/media/file/wine-800.png" } },
  },
  shortDescription: "A very special dining experience.",
  tickets: {
    priceLabel: "$110",
    ticketUrl: "https://tickets.test/wine",
    caption: "",
  },
  createdAt: "2026-07-09T03:41:04.000Z",
  _status: "published",
};

const journalDoc = {
  id: 7,
  title: "Winter stories from the kitchen",
  slug: "winter-stories",
  category: "story",
  summary: "What happens behind the pass in July.",
  mainImage: { url: "/api/media/file/winter.webp" },
  author: "Nick Loosley",
  publishedAt: "2026-07-10T00:00:00.000Z",
  createdAt: "2026-07-08T00:00:00.000Z",
  _status: "published",
};

describe("marketing-cms service", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearMarketingCmsCache();
    vi.stubEnv("MARKETING_CMS_URL", BASE_URL);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns empty lists without fetching when MARKETING_CMS_URL is unset", async () => {
    vi.stubEnv("MARKETING_CMS_URL", "");

    expect(await getUpcomingCmsEvents()).toEqual([]);
    expect(await getRecentCmsJournalPosts()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps event docs to CmsEvent with absolute URLs and portal location name", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ docs: [eventDoc] }));

    const events = await getUpcomingCmsEvents();

    expect(events).toEqual([
      {
        id: 62,
        slug: "wine-dinner-29-august",
        name: "Wine Dinner",
        date: "2026-08-29T06:00:00.000Z",
        displayTime: "6 - 9pm",
        location: "Onehunga",
        imageUrl: `${BASE_URL}/api/media/file/wine.webp`,
        shortDescription: "A very special dining experience.",
        priceLabel: "$110",
        ticketUrl: "https://tickets.test/wine",
        url: `${BASE_URL}/events/wine-dinner-29-august`,
        publishedAt: "2026-07-09T03:41:04.000Z",
      },
    ]);

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain(`${BASE_URL}/api/events?`);
    expect(requestedUrl).toContain(
      `${encodeURIComponent("where[_status][equals]")}=published`
    );
    expect(requestedUrl).toContain(
      encodeURIComponent("where[date][greater_than_equal]")
    );
  });

  it("handles events without location or image and drops invalid docs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        docs: [
          { ...eventDoc, id: 1, location: null, image: null },
          // Unresolved relationships come back as numeric IDs at depth 0.
          { ...eventDoc, id: 2, slug: "second", location: 5, image: 9 },
          { ...eventDoc, id: 3, slug: null },
          { ...eventDoc, id: 4, date: "not-a-date" },
        ],
      })
    );

    const events = await getUpcomingCmsEvents();

    expect(events.map((e) => e.id)).toEqual([1, 2]);
    expect(events[0].location).toBeNull();
    expect(events[0].imageUrl).toBeNull();
    expect(events[1].location).toBeNull();
    expect(events[1].imageUrl).toBeNull();
  });

  it("collapses newlines and whitespace runs in text fields", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        docs: [
          {
            ...eventDoc,
            shortDescription: "5 courses\nLocal artisan drinks\nOnehunga Eats ",
          },
        ],
      })
    );

    const events = await getUpcomingCmsEvents();
    expect(events[0].shortDescription).toBe(
      "5 courses Local artisan drinks Onehunga Eats"
    );
  });

  it("falls back to the CMS location name when menuLocationName is blank", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        docs: [
          {
            ...eventDoc,
            location: { name: "Wellington", menuLocationName: "  " },
          },
        ],
      })
    );

    const events = await getUpcomingCmsEvents();
    expect(events[0].location).toBe("Wellington");
  });

  it("maps journal docs to CmsJournalPost, falling back to createdAt", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        docs: [journalDoc, { ...journalDoc, id: 8, publishedAt: null }],
      })
    );

    const posts = await getRecentCmsJournalPosts();

    expect(posts[0]).toEqual({
      id: 7,
      slug: "winter-stories",
      title: "Winter stories from the kitchen",
      category: "story",
      summary: "What happens behind the pass in July.",
      imageUrl: `${BASE_URL}/api/media/file/winter.webp`,
      author: "Nick Loosley",
      publishedAt: "2026-07-10T00:00:00.000Z",
      url: `${BASE_URL}/journal/winter-stories`,
    });
    expect(posts[1].publishedAt).toBe("2026-07-08T00:00:00.000Z");

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toContain(`${BASE_URL}/api/journal-posts?`);
  });

  it("serves cached data within the TTL without re-fetching", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ docs: [eventDoc] }));

    await getUpcomingCmsEvents();
    await getUpcomingCmsEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves stale data when a refresh fails after the TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00.000Z"));
    fetchMock.mockResolvedValueOnce(jsonResponse({ docs: [eventDoc] }));

    const first = await getUpcomingCmsEvents();
    expect(first).toHaveLength(1);

    vi.setSystemTime(new Date("2026-07-15T00:10:00.000Z"));
    fetchMock.mockRejectedValueOnce(new Error("CMS down"));

    const second = await getUpcomingCmsEvents();
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns [] when the CMS is unreachable and nothing is cached", async () => {
    fetchMock.mockRejectedValue(new Error("CMS down"));

    expect(await getUpcomingCmsEvents()).toEqual([]);
    expect(await getRecentCmsJournalPosts()).toEqual([]);
  });

  it("returns [] on a non-OK response with nothing cached", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));

    expect(await getUpcomingCmsEvents()).toEqual([]);
  });

  describe("getCmsEventsForShift", () => {
    it("matches events on the same NZ day at the same portal location", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          docs: [
            eventDoc, // Onehunga, 2026-08-29 6pm NZ
            {
              ...eventDoc,
              id: 70,
              slug: "wellington-quiz",
              location: { name: "Wellington", menuLocationName: "Wellington" },
            },
            {
              ...eventDoc,
              id: 71,
              slug: "onehunga-next-week",
              date: "2026-09-05T06:00:00.000Z",
            },
          ],
        })
      );

      // 12:30pm NZ on the same day as the 6pm event.
      const shiftStart = new Date("2026-08-29T00:30:00.000Z");
      const events = await getCmsEventsForShift("Onehunga", shiftStart);

      expect(events.map((e) => e.id)).toEqual([62]);
    });

    it("returns [] for shifts without a location", async () => {
      const events = await getCmsEventsForShift(null, new Date());
      expect(events).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
