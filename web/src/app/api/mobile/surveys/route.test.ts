import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/survey-triggers", () => ({
  checkAndAssignSurveys: vi.fn(),
}));

vi.mock("@/lib/survey-assignments", () => ({
  getOpenSurveyAssignments: vi.fn(),
}));

import { GET } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getOpenSurveyAssignments } from "@/lib/survey-assignments";
import { checkAndAssignSurveys } from "@/lib/survey-triggers";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockCheckAndAssign = checkAndAssignSurveys as ReturnType<typeof vi.fn>;
const mockGetOpen = getOpenSurveyAssignments as ReturnType<typeof vi.fn>;

function makeRequest() {
  return new Request("http://localhost/api/mobile/surveys", {
    headers: { Authorization: "Bearer valid-token" },
  });
}

const ASSIGNED_AT = new Date("2026-09-30T02:00:00Z");

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assign-1",
    status: "PENDING",
    assignedAt: ASSIGNED_AT,
    dismissedAt: null,
    survey: {
      id: "survey-1",
      title: "How was your first shift?",
      description: "Two minutes, tops.",
    },
    questionCount: 4,
    token: "tok-1",
    expiresAt: null,
    ...overrides,
  };
}

describe("GET /api/mobile/surveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockCheckAndAssign.mockResolvedValue([]);
    mockGetOpen.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockCheckAndAssign).not.toHaveBeenCalled();
    expect(mockGetOpen).not.toHaveBeenCalled();
  });

  it("returns the volunteer's pending surveys", async () => {
    mockGetOpen.mockResolvedValue([assignment()]);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      surveys: [
        {
          assignmentId: "assign-1",
          token: "tok-1",
          title: "How was your first shift?",
          description: "Two minutes, tops.",
          questionCount: 4,
          assignedAt: ASSIGNED_AT.toISOString(),
        },
      ],
    });
  });

  it("only asks for surveys the volunteer hasn't dismissed", async () => {
    await GET(makeRequest());

    expect(mockGetOpen).toHaveBeenCalledWith("user-1", ["PENDING"]);
  });

  it("assigns due milestone surveys before listing, so they are in the response", async () => {
    const order: string[] = [];
    mockCheckAndAssign.mockImplementation(async () => {
      order.push("assign");
      return ["How was your first shift?"];
    });
    mockGetOpen.mockImplementation(async () => {
      order.push("list");
      return [assignment()];
    });

    const response = await GET(makeRequest());

    expect(mockCheckAndAssign).toHaveBeenCalledWith("user-1");
    expect(order).toEqual(["assign", "list"]);
    expect((await response.json()).surveys).toHaveLength(1);
  });

  it("leaves out an assignment that has no token to open it with", async () => {
    mockGetOpen.mockResolvedValue([
      assignment({ id: "assign-legacy", token: undefined }),
      assignment({ id: "assign-2", token: "tok-2" }),
    ]);

    const json = await (await GET(makeRequest())).json();

    expect(json.surveys.map((s: { assignmentId: string }) => s.assignmentId)).toEqual([
      "assign-2",
    ]);
  });

  it("returns 500 when the list can't be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetOpen.mockRejectedValue(new Error("db down"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
  });
});
