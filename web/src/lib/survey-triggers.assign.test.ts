import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("./prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    signup: { findFirst: vi.fn() },
    survey: { findMany: vi.fn() },
    surveyAssignment: { findMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("./achievements", () => ({
  calculateUserProgress: vi.fn(),
}));

vi.mock("./notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock("./email-service", () => ({
  sendSurveyNotification: vi.fn().mockResolvedValue(undefined),
}));

import { Prisma } from "@/generated/client";
import { calculateUserProgress } from "./achievements";
import { sendSurveyNotification } from "./email-service";
import { createNotification } from "./notifications";
import { prisma } from "./prisma";
import { checkAndAssignSurveys } from "./survey-triggers";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  signup: { findFirst: ReturnType<typeof vi.fn> };
  survey: { findMany: ReturnType<typeof vi.fn> };
  surveyAssignment: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};
const mockProgress = calculateUserProgress as ReturnType<typeof vi.fn>;
const mockNotify = createNotification as ReturnType<typeof vi.fn>;
const mockEmail = sendSurveyNotification as ReturnType<typeof vi.fn>;

const USER = {
  id: "user-1",
  email: "aroha@example.com",
  name: "Aroha",
  createdAt: new Date("2025-01-01"),
  archivedAt: null,
};

function survey(id: string, triggerValue: number) {
  return {
    id,
    title: `Survey ${id}`,
    triggerType: "SHIFTS_COMPLETED",
    triggerValue,
    triggerMaxValue: null,
  };
}

describe("checkAndAssignSurveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(USER);
    mockPrisma.surveyAssignment.findMany.mockResolvedValue([]);
    mockPrisma.survey.findMany.mockResolvedValue([]);
    mockPrisma.signup.findFirst.mockResolvedValue(null);
    mockProgress.mockResolvedValue({ shifts_completed: 10 });
    mockPrisma.surveyAssignment.create.mockImplementation(
      async ({ data }: { data: { surveyId: string; token: { create: { token: string } } } }) => ({
        id: `assign-${data.surveyId}`,
        surveyId: data.surveyId,
        token: { token: data.token.create.token },
      })
    );
  });

  it("skips the progress queries when there is no survey left to evaluate", async () => {
    const assigned = await checkAndAssignSurveys("user-1");

    expect(assigned).toEqual([]);
    expect(mockProgress).not.toHaveBeenCalled();
    expect(mockPrisma.signup.findFirst).not.toHaveBeenCalled();
  });

  it("does nothing for an archived volunteer", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...USER,
      archivedAt: new Date(),
    });
    mockPrisma.survey.findMany.mockResolvedValue([survey("a", 5)]);

    const assigned = await checkAndAssignSurveys("user-1");

    expect(assigned).toEqual([]);
    expect(mockPrisma.surveyAssignment.create).not.toHaveBeenCalled();
  });

  it("assigns a due survey with its token, then notifies and emails", async () => {
    mockPrisma.survey.findMany.mockResolvedValue([
      survey("due", 5),
      survey("not-yet", 50),
    ]);

    const assigned = await checkAndAssignSurveys("user-1");

    expect(assigned).toEqual(["Survey due"]);
    expect(mockPrisma.surveyAssignment.create).toHaveBeenCalledTimes(1);

    const { data } = mockPrisma.surveyAssignment.create.mock.calls[0][0];
    expect(data).toMatchObject({
      surveyId: "due",
      userId: "user-1",
      status: "PENDING",
    });
    // Created in the same write, so an assignment can't be left without one.
    const token = data.token.create.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "SURVEY_ASSIGNED",
        actionUrl: `/surveys/${token}`,
        relatedId: "assign-due",
      })
    );
    expect(mockEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "aroha@example.com",
        surveyTitle: "Survey due",
        surveyUrl: expect.stringContaining(`/surveys/${token}`),
      })
    );
  });

  it("stands down quietly when another request assigned the survey first", async () => {
    mockPrisma.survey.findMany.mockResolvedValue([
      survey("raced", 5),
      survey("ours", 5),
    ]);
    mockPrisma.surveyAssignment.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const assigned = await checkAndAssignSurveys("user-1");

    // The loser of the race sends nothing for that survey, and carries on.
    expect(assigned).toEqual(["Survey ours"]);
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockEmail).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("still counts the survey as assigned when the email fails", async () => {
    mockPrisma.survey.findMany.mockResolvedValue([survey("due", 5)]);
    mockEmail.mockRejectedValueOnce(new Error("campaign monitor down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const assigned = await checkAndAssignSurveys("user-1");

    expect(assigned).toEqual(["Survey due"]);
  });
});
