import { describe, expect, it, vi } from "vitest";

// `./api` pulls in expo-secure-store, which has no native module under vitest.
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn() }));

import { ApiError } from "./api";
import { surveyProblem } from "./survey-problem";

describe("surveyProblem", () => {
  it("recognises a survey that was already answered", () => {
    const error = new ApiError(404, "Survey has already been completed", {
      code: "completed",
    });
    expect(surveyProblem(error)).toBe("completed");
  });

  it("treats a bad link or a closed survey as unavailable", () => {
    expect(
      surveyProblem(new ApiError(404, "Invalid survey token", { code: "invalid" }))
    ).toBe("unavailable");
    expect(
      surveyProblem(
        new ApiError(404, "This survey is no longer available", { code: "inactive" })
      )
    ).toBe("unavailable");
    expect(surveyProblem(new ApiError(410, "Survey expired"))).toBe("unavailable");
  });

  it("treats everything else as worth retrying", () => {
    expect(surveyProblem(new ApiError(500, "Failed to validate survey token"))).toBe("error");
    expect(surveyProblem(new TypeError("Network request failed"))).toBe("error");
  });
});
