/**
 * Survey types and the rules for answering one. Mirrors
 * `web/src/types/survey.ts` and the checks in the submit route
 * (`web/src/app/api/surveys/[token]/submit/route.ts`), which stays the
 * authority: this only saves a volunteer the round trip to be told a required
 * question was missed.
 */

export type SurveyQuestionType =
  | "text_short"
  | "text_long"
  | "multiple_choice_single"
  | "multiple_choice_multi"
  | "rating_scale"
  | "yes_no";

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  /** Multiple choice */
  options?: string[];
  /** Rating scale */
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  /** Text */
  placeholder?: string;
  maxLength?: number;
};

export type SurveyAnswerValue = string | string[] | number | boolean | null;

export type SurveyAnswer = {
  questionId: string;
  value: SurveyAnswerValue;
};

/** Answers so far, keyed by question id. */
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

/** A survey waiting on the volunteer, as listed by GET /api/mobile/surveys. */
export type PendingSurvey = {
  assignmentId: string;
  token: string;
  title: string;
  description: string | null;
  questionCount: number;
  assignedAt: string;
};

/** A survey opened by its token, from GET /api/surveys/[token]. */
export type SurveyDetail = {
  survey: {
    id: string;
    title: string;
    description: string | null;
    questions: SurveyQuestion[];
  };
  assignment: { id: string };
};

/** Whether a value counts as an answer. A cleared field or selection doesn't. */
export function isAnswered(value: SurveyAnswerValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function countAnswered(
  questions: SurveyQuestion[],
  answers: SurveyAnswers
): number {
  return questions.filter((q) => isAnswered(answers[q.id])).length;
}

/**
 * The message for each required question still without an answer, keyed by
 * question id. Empty when the survey is ready to send.
 */
export function validateAnswers(
  questions: SurveyQuestion[],
  answers: SurveyAnswers
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of questions) {
    if (!question.required || isAnswered(answers[question.id])) continue;
    errors[question.id] =
      question.type === "multiple_choice_multi"
        ? "Please choose at least one option."
        : question.type === "text_short" || question.type === "text_long"
          ? "Please write an answer."
          : "Please choose an answer.";
  }
  return errors;
}

/**
 * The answers in the shape the submit route takes. Questions left blank are
 * left out, and so is anything stored for a question the survey no longer has
 * (a draft can outlive an edit to the survey).
 */
export function toSubmission(
  questions: SurveyQuestion[],
  answers: SurveyAnswers
): SurveyAnswer[] {
  return questions.flatMap((question) => {
    const value = answers[question.id];
    if (!isAnswered(value)) return [];
    return [
      {
        questionId: question.id,
        value: typeof value === "string" ? value.trim() : value,
      },
    ];
  });
}

/**
 * Longest scale drawn. The web editor suggests 1 to 5 and 0 to 10; this only
 * stops a mistyped maximum (1 to 1000) from rendering a thousand buttons.
 */
const MAX_SCALE_POINTS = 21;

/** The points on a rating question, low to high (the web default is 1 to 5). */
export function ratingPoints(question: SurveyQuestion): number[] {
  const min = Math.trunc(question.minValue ?? 1);
  const max = Math.trunc(question.maxValue ?? 5);
  const low = Math.min(min, max);
  const count = Math.min(Math.abs(max - min) + 1, MAX_SCALE_POINTS);
  return Array.from({ length: count }, (_, i) => low + i);
}

/** Most buttons that fit across a phone at a comfortable touch size. */
const MAX_POINTS_PER_ROW = 6;

/**
 * Split a scale into rows that fit a phone. Up to six points sit on one row;
 * a longer scale breaks into rows of near-equal length (0 to 10 becomes six
 * then five), longest first so the last row never looks cut short.
 */
export function ratingRows(points: number[]): number[][] {
  const rowCount = Math.ceil(points.length / MAX_POINTS_PER_ROW);
  if (rowCount <= 1) return [points];
  const perRow = Math.ceil(points.length / rowCount);
  const rows: number[][] = [];
  for (let i = 0; i < points.length; i += perRow) {
    rows.push(points.slice(i, i + perRow));
  }
  return rows;
}

/** "1 question" / "5 questions", for the home card. */
export function questionCountLabel(count: number): string {
  return count === 1 ? "1 question" : `${count} questions`;
}
