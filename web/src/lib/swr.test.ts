import { afterEach, describe, expect, it, vi } from "vitest";
import type { SWRConfiguration } from "swr";
import { describeError, FetchError, fetchJson, swrConfig } from "./swr";

type OnErrorRetry = NonNullable<SWRConfiguration["onErrorRetry"]>;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed body for a 2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 200))
    );
    await expect(fetchJson("/api/thing")).resolves.toEqual({ ok: true });
  });

  it("throws a FetchError carrying the API's own error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Not allowed" }, 403))
    );
    const error = await fetchJson("/api/thing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FetchError);
    expect(error).toMatchObject({
      status: 403,
      apiError: "Not allowed",
      message: "Not allowed",
    });
  });

  it("falls back to a status message when the body has no error string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 502 }))
    );
    const error = await fetchJson("/api/thing").catch((e: unknown) => e);
    expect(error).toMatchObject({
      status: 502,
      apiError: null,
      message: "Request failed (502)",
    });
  });
});

describe("describeError", () => {
  it("prefers the API's own message", () => {
    expect(describeError(new FetchError(400, "Bad date"), "Fallback")).toBe(
      "Bad date"
    );
  });

  it("uses the fallback when the API gave no message", () => {
    expect(describeError(new FetchError(500, null), "Fallback")).toBe(
      "Fallback"
    );
  });

  it("uses the fallback for network and unknown errors", () => {
    expect(describeError(new TypeError("Failed to fetch"), "Fallback")).toBe(
      "Fallback"
    );
    expect(describeError(undefined, "Fallback")).toBe("Fallback");
  });
});

describe("swrConfig.onErrorRetry", () => {
  const onErrorRetry = swrConfig.onErrorRetry as OnErrorRetry;
  const config = {} as Parameters<OnErrorRetry>[2];

  afterEach(() => {
    vi.useRealTimers();
  });

  function retry(error: unknown, retryCount: number) {
    vi.useFakeTimers();
    const revalidate = vi.fn();
    onErrorRetry(error, "/api/thing", config, revalidate, {
      retryCount,
      dedupe: false,
    });
    vi.runAllTimers();
    return revalidate;
  }

  it("never retries a client error", () => {
    expect(retry(new FetchError(404, null), 0)).not.toHaveBeenCalled();
  });

  it("retries server and network errors", () => {
    expect(retry(new FetchError(503, null), 0)).toHaveBeenCalledWith({
      retryCount: 0,
    });
    expect(retry(new TypeError("Failed to fetch"), 1)).toHaveBeenCalledWith({
      retryCount: 1,
    });
  });

  it("gives up after three retries", () => {
    expect(retry(new FetchError(500, null), 3)).not.toHaveBeenCalled();
  });

  it("backs off exponentially", () => {
    vi.useFakeTimers();
    const revalidate = vi.fn();
    onErrorRetry(new FetchError(500, null), "/api/thing", config, revalidate, {
      retryCount: 2,
      dedupe: false,
    });
    vi.advanceTimersByTime(19_999);
    expect(revalidate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
