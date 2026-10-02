import { ApiError } from "./api";

/**
 * Why a survey couldn't be opened or sent:
 * - `completed`: already answered, here or on the website. Good news.
 * - `unavailable`: the link is wrong, or the survey has been closed.
 * - `error`: anything else (no signal, server trouble). Worth retrying.
 */
export type SurveyProblem = "completed" | "unavailable" | "error";

export function surveyProblem(error: unknown): SurveyProblem {
  if (!(error instanceof ApiError)) return "error";
  if (error.data?.code === "completed") return "completed";
  if (error.status === 404 || error.status === 410) return "unavailable";
  return "error";
}
