import { describe, expect, it } from "vitest";

import {
  countAnswered,
  isAnswered,
  questionCountLabel,
  ratingPoints,
  ratingRows,
  toSubmission,
  validateAnswers,
  type SurveyQuestion,
} from "./surveys";

function question(overrides: Partial<SurveyQuestion> & { id: string }): SurveyQuestion {
  return { type: "text_short", text: "Question", required: false, ...overrides };
}

const QUESTIONS: SurveyQuestion[] = [
  question({ id: "nps", type: "rating_scale", required: true, minValue: 0, maxValue: 10 }),
  question({ id: "why", type: "text_long", required: true }),
  question({ id: "skills", type: "multiple_choice_multi", required: true, options: ["Cooking", "Service"] }),
  question({ id: "again", type: "yes_no", required: true }),
  question({ id: "extra", type: "text_short" }),
];

describe("isAnswered", () => {
  it("counts a zero rating and a 'no' as answers", () => {
    expect(isAnswered(0)).toBe(true);
    expect(isAnswered(false)).toBe(true);
  });

  it("doesn't count a blank, cleared or whitespace-only answer", () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered("")).toBe(false);
    expect(isAnswered("   \n")).toBe(false);
    expect(isAnswered([])).toBe(false);
  });

  it("counts text and a selection", () => {
    expect(isAnswered("Loved it")).toBe(true);
    expect(isAnswered(["Cooking"])).toBe(true);
  });
});

describe("countAnswered", () => {
  it("counts only questions with a real answer", () => {
    expect(
      countAnswered(QUESTIONS, { nps: 0, why: "  ", skills: [], again: false })
    ).toBe(2);
  });

  it("ignores answers to questions the survey doesn't have", () => {
    expect(countAnswered(QUESTIONS, { gone: "stale draft" })).toBe(0);
  });
});

describe("validateAnswers", () => {
  it("flags every required question left blank, with a message that fits it", () => {
    expect(validateAnswers(QUESTIONS, {})).toEqual({
      nps: "Please choose an answer.",
      why: "Please write an answer.",
      skills: "Please choose at least one option.",
      again: "Please choose an answer.",
    });
  });

  it("accepts a zero rating and a 'no'", () => {
    const errors = validateAnswers(QUESTIONS, {
      nps: 0,
      why: "Great team",
      skills: ["Cooking"],
      again: false,
    });
    expect(errors).toEqual({});
  });

  it("treats a whitespace-only answer as blank", () => {
    const errors = validateAnswers(QUESTIONS, {
      nps: 9,
      why: "   ",
      skills: ["Service"],
      again: true,
    });
    expect(Object.keys(errors)).toEqual(["why"]);
  });

  it("never requires an optional question", () => {
    expect(validateAnswers([question({ id: "extra" })], {})).toEqual({});
  });
});

describe("toSubmission", () => {
  it("sends answered questions in survey order, trimming text", () => {
    expect(
      toSubmission(QUESTIONS, {
        extra: "  see you next week ",
        again: false,
        nps: 0,
        skills: ["Cooking", "Service"],
        why: "Great team",
      })
    ).toEqual([
      { questionId: "nps", value: 0 },
      { questionId: "why", value: "Great team" },
      { questionId: "skills", value: ["Cooking", "Service"] },
      { questionId: "again", value: false },
      { questionId: "extra", value: "see you next week" },
    ]);
  });

  it("leaves out blanks and answers to questions that no longer exist", () => {
    expect(
      toSubmission(QUESTIONS, { nps: 7, why: "", skills: [], gone: "stale" })
    ).toEqual([{ questionId: "nps", value: 7 }]);
  });
});

describe("ratingPoints", () => {
  it("defaults to 1 to 5, like the web form", () => {
    expect(ratingPoints(question({ id: "r", type: "rating_scale" }))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("covers a 0 to 10 scale inclusively", () => {
    const points = ratingPoints(
      question({ id: "r", type: "rating_scale", minValue: 0, maxValue: 10 })
    );
    expect(points).toHaveLength(11);
    expect(points[0]).toBe(0);
    expect(points[10]).toBe(10);
  });

  it("reads a scale entered back to front", () => {
    expect(
      ratingPoints(question({ id: "r", type: "rating_scale", minValue: 5, maxValue: 1 }))
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("caps a mistyped maximum instead of drawing hundreds of buttons", () => {
    expect(
      ratingPoints(question({ id: "r", type: "rating_scale", minValue: 1, maxValue: 1000 }))
    ).toHaveLength(21);
  });
});

describe("ratingRows", () => {
  const scale = (min: number, max: number) =>
    Array.from({ length: max - min + 1 }, (_, i) => min + i);

  it("keeps a short scale on one row", () => {
    expect(ratingRows(scale(1, 5))).toEqual([[1, 2, 3, 4, 5]]);
    expect(ratingRows(scale(1, 6))).toHaveLength(1);
  });

  it("breaks 0 to 10 into six then five", () => {
    expect(ratingRows(scale(0, 10))).toEqual([
      [0, 1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ]);
  });

  it("breaks 1 to 10 into two even rows", () => {
    expect(ratingRows(scale(1, 10))).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
    ]);
  });

  it("never puts more than six on a row, however long the scale", () => {
    const rows = ratingRows(scale(0, 20));
    expect(rows.flat()).toEqual(scale(0, 20));
    expect(Math.max(...rows.map((r) => r.length))).toBeLessThanOrEqual(6);
  });
});

describe("questionCountLabel", () => {
  it("pluralises", () => {
    expect(questionCountLabel(1)).toBe("1 question");
    expect(questionCountLabel(5)).toBe("5 questions");
  });
});
