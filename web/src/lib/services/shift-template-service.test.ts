import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyTemplateNotesToUpcomingShifts,
  countUpcomingShiftsByTemplate,
} from "./shift-template-service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: {
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const updateMany = vi.mocked(prisma.shift.updateMany);
const groupBy = vi.mocked(prisma.shift.groupBy);

describe("applyTemplateNotesToUpcomingShifts", () => {
  const now = new Date("2026-08-27T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 3 });
  });

  it("updates upcoming shifts that still carry the template's previous notes", async () => {
    const count = await applyTemplateNotesToUpcomingShifts({
      templateId: "template-1",
      previousNotes: "Bring closed shoes",
      nextNotes: "Bring closed shoes and an apron",
      now,
    });

    expect(count).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        templateId: "template-1",
        start: { gte: now },
        notes: "Bring closed shoes",
      },
      data: { notes: "Bring closed shoes and an apron" },
    });
  });

  it("treats empty and whitespace-only notes as no notes", async () => {
    await applyTemplateNotesToUpcomingShifts({
      templateId: "template-1",
      previousNotes: "   ",
      nextNotes: "Park on the street",
      now,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ notes: null }),
      })
    );
  });

  it("clears the notes on matching shifts when the template's notes are removed", async () => {
    await applyTemplateNotesToUpcomingShifts({
      templateId: "template-1",
      previousNotes: "Bring closed shoes",
      nextNotes: null,
      now,
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notes: null } })
    );
  });

  it("does nothing when the notes did not change", async () => {
    const count = await applyTemplateNotesToUpcomingShifts({
      templateId: "template-1",
      previousNotes: "Bring closed shoes",
      nextNotes: "Bring closed shoes",
      now,
    });

    expect(count).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("countUpcomingShiftsByTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a count per template", async () => {
    groupBy.mockResolvedValue([
      { templateId: "template-1", _count: { _all: 4 } },
      { templateId: "template-2", _count: { _all: 1 } },
    ] as never);

    const counts = await countUpcomingShiftsByTemplate([
      "template-1",
      "template-2",
    ]);

    expect(counts.get("template-1")).toBe(4);
    expect(counts.get("template-2")).toBe(1);
  });

  it("skips the query when there are no templates", async () => {
    const counts = await countUpcomingShiftsByTemplate([]);

    expect(counts.size).toBe(0);
    expect(groupBy).not.toHaveBeenCalled();
  });
});
