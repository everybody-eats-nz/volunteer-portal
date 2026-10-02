import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/survey-assignments", () => ({
  dismissSurveyAssignment: vi.fn(),
}));

import { POST } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { dismissSurveyAssignment } from "@/lib/survey-assignments";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockDismiss = dismissSurveyAssignment as ReturnType<typeof vi.fn>;

function call(assignmentId = "assign-1") {
  return POST(
    new Request(
      `http://localhost/api/mobile/surveys/${assignmentId}/dismiss`,
      { method: "POST", headers: { Authorization: "Bearer valid-token" } }
    ),
    { params: Promise.resolve({ assignmentId }) }
  );
}

describe("POST /api/mobile/surveys/[assignmentId]/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(401);
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("dismisses the survey for the signed-in volunteer", async () => {
    mockDismiss.mockResolvedValue({ ok: true });

    const response = await call("assign-9");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockDismiss).toHaveBeenCalledWith("user-1", "assign-9");
  });

  it("passes on the reason a survey can't be dismissed", async () => {
    mockDismiss.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Unauthorized",
    });

    const response = await call();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when the dismissal fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDismiss.mockRejectedValue(new Error("db down"));

    const response = await call();

    expect(response.status).toBe(500);
  });
});
