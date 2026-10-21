import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn() }));

import { ApiError } from "@/lib/api";
import { loadErrorKind } from "@/lib/load-error";

describe("loadErrorKind", () => {
  it("treats a 404 as not-found", () => {
    expect(loadErrorKind(new ApiError(404, "Not found"))).toBe("not-found");
  });

  it("treats any other server failure as a retryable error", () => {
    expect(loadErrorKind(new ApiError(500, "Boom"))).toBe("error");
    expect(loadErrorKind(new ApiError(403, "Forbidden"))).toBe("error");
  });

  it("treats a fetch that never reached the server as offline", () => {
    expect(loadErrorKind(new TypeError("Network request failed"))).toBe("offline");
    expect(loadErrorKind("Network request failed")).toBe("offline");
    expect(loadErrorKind(new Error("The request timed out."))).toBe("offline");
  });

  it("falls back to a retryable error for anything else", () => {
    expect(loadErrorKind(new Error("Unexpected token"))).toBe("error");
    expect(loadErrorKind(undefined)).toBe("error");
  });
});
