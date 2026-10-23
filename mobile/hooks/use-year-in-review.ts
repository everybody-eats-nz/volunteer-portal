import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

type YearInReviewAvailability = {
  /** True once an admin has switched it on and they have a completed shift. */
  available: boolean;
  year: number;
};

/**
 * Whether the signed-in volunteer has a Year in mahi video to watch. The
 * player is a web page the year-in-review screen opens in a WebView, so it
 * updates without an app release.
 */
export function useYearInReview() {
  const query = useQuery({
    queryKey: queryKeys.yearInReview.availability(),
    queryFn: () =>
      api<YearInReviewAvailability>('/api/mobile/year-in-review'),
  });

  return {
    available: query.data?.available ?? false,
    year: query.data?.year ?? null,
    refresh: async () => {
      await query.refetch();
    },
  };
}

/** GET / POST /api/year-in-review/video. */
export type YearInReviewVideo = {
  status: 'NONE' | 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
  /** 0-100 while rendering. */
  progress: number;
  /** Videos queued before this one. */
  ahead: number;
  /** Path on the API server; needs the bearer token. */
  fileUrl: string | null;
};

const isWorking = (video?: YearInReviewVideo) =>
  video?.status === 'QUEUED' || video?.status === 'RENDERING';

/**
 * The server-rendered MP4. `request()` asks the server to make it (or reuses
 * an up-to-date one); while it renders, the status is polled.
 */
export function useYearInReviewVideo() {
  const queryClient = useQueryClient();
  const key = queryKeys.yearInReview.video();

  const query = useQuery({
    queryKey: key,
    queryFn: () => api<YearInReviewVideo>('/api/year-in-review/video'),
    // Always ask afresh: a re-render can replace the file at any time.
    staleTime: 0,
    refetchInterval: (q) => (isWorking(q.state.data) ? 2500 : false),
  });

  const request = useMutation({
    mutationFn: () =>
      api<YearInReviewVideo>('/api/year-in-review/video', { method: 'POST' }),
    onSuccess: (video) => queryClient.setQueryData(key, video),
  });

  return {
    video: query.data,
    working: isWorking(query.data) || request.isPending,
    request: () => request.mutateAsync(),
  };
}
