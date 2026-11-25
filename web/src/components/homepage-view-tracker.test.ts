import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageViewTracker } from "./homepage-view-tracker";
import { captureFunnelEvent, getPhidFromCookies } from "@/lib/funnel";

vi.mock("@/lib/funnel", () => ({
  captureFunnelEvent: vi.fn(),
  FunnelEvent: { HOMEPAGE_VIEWED: "homepage_viewed" },
  getPhidFromCookies: vi.fn(),
}));

describe("HomepageViewTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captures homepage_viewed with the visitor's PostHog cookie and renders nothing", async () => {
    vi.mocked(getPhidFromCookies).mockResolvedValue("phid-123");

    const rendered = await HomepageViewTracker();

    expect(rendered).toBeNull();
    expect(captureFunnelEvent).toHaveBeenCalledTimes(1);
    expect(captureFunnelEvent).toHaveBeenCalledWith({
      event: "homepage_viewed",
      phid: "phid-123",
    });
  });

  it("still hands the event to captureFunnelEvent when there is no cookie", async () => {
    vi.mocked(getPhidFromCookies).mockResolvedValue(undefined);

    await HomepageViewTracker();

    // captureFunnelEvent itself no-ops without a distinct id.
    expect(captureFunnelEvent).toHaveBeenCalledWith({
      event: "homepage_viewed",
      phid: undefined,
    });
  });
});
