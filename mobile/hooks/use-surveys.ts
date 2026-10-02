import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type {
  PendingSurvey,
  SurveyAnswer,
  SurveyDetail,
} from '@/lib/surveys';

type PendingResponse = {
  surveys: PendingSurvey[];
};

const PENDING_KEY = queryKeys.surveys.pending();

type UsePendingSurveysReturn = {
  surveys: PendingSurvey[];
  refresh: () => Promise<void>;
  /**
   * "Don't ask again". The card goes at once and comes back if the request
   * fails, in which case this rejects so the caller can say so.
   */
  dismiss: (assignmentId: string) => Promise<void>;
};

/**
 * Surveys waiting on the signed-in volunteer, for the home tab. Loading this
 * is also what assigns a milestone survey they have just become due for (see
 * GET /api/mobile/surveys), so the home tab mounts it even when the list is
 * usually empty.
 */
export function usePendingSurveys(): UsePendingSurveysReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => api<PendingResponse>('/api/mobile/surveys'),
  });

  const dismiss = useMutation({
    mutationFn: (assignmentId: string) =>
      api(`/api/mobile/surveys/${assignmentId}/dismiss`, { method: 'POST' }),
    onMutate: async (assignmentId) => {
      await queryClient.cancelQueries({ queryKey: PENDING_KEY });
      const snapshot = queryClient.getQueryData<PendingResponse>(PENDING_KEY);
      queryClient.setQueryData<PendingResponse>(PENDING_KEY, (prev) =>
        prev
          ? {
              surveys: prev.surveys.filter(
                (s) => s.assignmentId !== assignmentId
              ),
            }
          : prev
      );
      return { snapshot };
    },
    onError: (_err, _assignmentId, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(PENDING_KEY, ctx.snapshot);
      }
    },
  });

  return {
    surveys: query.data?.surveys ?? [],
    refresh: async () => {
      await query.refetch();
    },
    dismiss: async (assignmentId) => {
      await dismiss.mutateAsync(assignmentId);
    },
  };
}

/**
 * One survey, opened by the token from its notification or home card. The
 * token routes are the same public ones the web survey page uses.
 */
export function useSurvey(token: string) {
  return useQuery({
    queryKey: queryKeys.surveys.detail(token),
    queryFn: () =>
      api<SurveyDetail>(`/api/surveys/${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    // A survey is opened once. Dropping it when the screen closes means the
    // next open asks the server again, which is what turns a survey answered
    // in the meantime into "already done" instead of a form that can't be sent.
    gcTime: 0,
  });
}

export function useSubmitSurvey(token: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (answers: SurveyAnswer[]) =>
      api(`/api/surveys/${encodeURIComponent(token)}/submit`, {
        method: 'POST',
        body: { answers },
      }),
    onSuccess: () => {
      // Take the card off the home tab without waiting for the refetch.
      queryClient.setQueryData<PendingResponse>(PENDING_KEY, (prev) =>
        prev
          ? { surveys: prev.surveys.filter((s) => s.token !== token) }
          : prev
      );
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
      // Submitting marks the survey's notification as read on the server.
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
