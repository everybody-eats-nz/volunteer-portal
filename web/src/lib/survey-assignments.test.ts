import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    surveyAssignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "./prisma";
import {
  dismissSurveyAssignment,
  getOpenSurveyAssignments,
} from "./survey-assignments";

const mockAssignment = prisma.surveyAssignment as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe("survey-assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOpenSurveyAssignments", () => {
    const row = {
      id: "assign-1",
      status: "PENDING",
      assignedAt: new Date("2026-09-30T02:00:00Z"),
      dismissedAt: null,
      survey: {
        id: "survey-1",
        title: "How was your first shift?",
        description: null,
      },
      token: { token: "tok-1", expiresAt: null },
    };

    it("includes dismissed surveys unless asked for pending only", async () => {
      mockAssignment.findMany.mockResolvedValue([]);

      await getOpenSurveyAssignments("user-1");
      await getOpenSurveyAssignments("user-1", ["PENDING"]);

      expect(mockAssignment.findMany.mock.calls[0][0].where).toEqual({
        userId: "user-1",
        status: { in: ["PENDING", "DISMISSED"] },
        survey: { isActive: true },
      });
      expect(mockAssignment.findMany.mock.calls[1][0].where.status).toEqual({
        in: ["PENDING"],
      });
    });

    it("flattens the token, and never loads the survey's questions", async () => {
      mockAssignment.findMany.mockResolvedValue([row]);

      const [assignment] = await getOpenSurveyAssignments("user-1");

      expect(assignment).toEqual({
        id: "assign-1",
        status: "PENDING",
        assignedAt: row.assignedAt,
        dismissedAt: null,
        survey: {
          id: "survey-1",
          title: "How was your first shift?",
          description: null,
        },
        token: "tok-1",
        expiresAt: null,
      });
      expect(
        mockAssignment.findMany.mock.calls[0][0].include.survey.select
      ).toEqual({ id: true, title: true, description: true });
    });

    it("copes with an assignment whose token was never created", async () => {
      mockAssignment.findMany.mockResolvedValue([{ ...row, token: null }]);

      const [assignment] = await getOpenSurveyAssignments("user-1");

      expect(assignment.token).toBeUndefined();
    });
  });

  describe("dismissSurveyAssignment", () => {
    it("reports a missing assignment", async () => {
      mockAssignment.findUnique.mockResolvedValue(null);

      const result = await dismissSurveyAssignment("user-1", "nope");

      expect(result).toEqual({
        ok: false,
        status: 404,
        error: "Survey assignment not found",
      });
    });

    it("refuses to dismiss somebody else's survey", async () => {
      mockAssignment.findUnique.mockResolvedValue({
        userId: "user-2",
        status: "PENDING",
      });

      const result = await dismissSurveyAssignment("user-1", "assign-1");

      expect(result).toMatchObject({ ok: false, status: 403 });
      expect(mockAssignment.update).not.toHaveBeenCalled();
    });

    it("dismisses a pending survey", async () => {
      mockAssignment.findUnique.mockResolvedValue({
        userId: "user-1",
        status: "PENDING",
      });

      const result = await dismissSurveyAssignment("user-1", "assign-1");

      expect(result).toEqual({ ok: true });
      expect(mockAssignment.update).toHaveBeenCalledWith({
        where: { id: "assign-1" },
        data: { status: "DISMISSED", dismissedAt: expect.any(Date) },
      });
    });

    it("treats a repeat dismissal as done, keeping the original time", async () => {
      mockAssignment.findUnique.mockResolvedValue({
        userId: "user-1",
        status: "DISMISSED",
      });

      const result = await dismissSurveyAssignment("user-1", "assign-1");

      expect(result).toEqual({ ok: true });
      expect(mockAssignment.update).not.toHaveBeenCalled();
    });

    it("won't dismiss a survey that has already been answered", async () => {
      mockAssignment.findUnique.mockResolvedValue({
        userId: "user-1",
        status: "COMPLETED",
      });

      const result = await dismissSurveyAssignment("user-1", "assign-1");

      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(mockAssignment.update).not.toHaveBeenCalled();
    });
  });
});
