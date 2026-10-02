import { create } from 'zustand';

import type { SurveyAnswerValue, SurveyAnswers } from '@/lib/surveys';

/**
 * Answers to surveys that haven't been sent yet, keyed by survey token.
 *
 * The survey screen keeps its answers here rather than in its own state, so
 * backing out halfway (a stray swipe, a notification tapped mid-answer) and
 * coming back picks up where the volunteer left off. In memory only: answers
 * are theirs until they choose to send them, and nothing is written to disk.
 */
type SurveyDraftState = {
  drafts: Record<string, SurveyAnswers>;
  setAnswer: (
    token: string,
    questionId: string,
    value: SurveyAnswerValue
  ) => void;
  clear: (token: string) => void;
};

export const useSurveyDraftStore = create<SurveyDraftState>((set) => ({
  drafts: {},
  setAnswer: (token, questionId, value) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [token]: { ...state.drafts[token], [questionId]: value },
      },
    })),
  clear: (token) =>
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[token];
      return { drafts };
    }),
}));
