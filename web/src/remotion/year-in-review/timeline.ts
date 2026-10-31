import type { YearInReviewProps } from "./schema";

export const FPS = 30;

/** The music bed's tempo (`scripts/year-in-review-sounds.ts`). */
export const BPM = 92;
/** One beat, in seconds. Scene lengths are whole beats so every cut lands on one. */
export const BEAT = 60 / BPM;
/** Seconds for `n` beats. */
export const beats = (n: number) => n * BEAT;

/**
 * Frames the push takes to bring a scene up over the previous one. Each
 * scene except the last carries this overlap, so scene starts stay on the
 * beat.
 */
export const TRANSITION_FRAMES = 14;

export type SceneId =
  | "intro"
  | "shifts"
  | "meals"
  | "rhythm"
  | "roles"
  | "crew"
  | "achievements"
  | "topPercent"
  | "together"
  | "docket"
  | "outro";

/**
 * The scenes this volunteer's video plays, in order, and how many beats
 * each gets. Stories with nothing to say (no friends on shift, no new
 * badges) are left out rather than shown empty, and the video gets shorter.
 */
function sceneBeats(
  props: YearInReviewProps
): { id: SceneId; beats: number }[] {
  const scenes: { id: SceneId; beats: number; show: boolean }[] = [
    { id: "intro", beats: 6, show: true },
    { id: "shifts", beats: 8, show: true },
    { id: "meals", beats: 7, show: props.impact.mealsServed > 0 },
    { id: "rhythm", beats: 8, show: true },
    { id: "roles", beats: 8, show: props.roles.length > 0 },
    { id: "crew", beats: 7, show: props.crew.alongside > 0 },
    { id: "achievements", beats: 8, show: props.achievements.length > 0 },
    { id: "topPercent", beats: 6, show: props.topPercent !== null },
    { id: "together", beats: 9, show: true },
    { id: "docket", beats: 9, show: true },
    { id: "outro", beats: 6, show: true },
  ];
  return scenes.filter((s) => s.show).map(({ id, beats: b }) => ({ id, beats: b }));
}

/**
 * Each scene's length in frames. Scene starts are rounded from the running
 * beat count, not accumulated, so they never drift off the beat. Every scene
 * but the last also plays on under the next one's push.
 */
export function getScenes(
  props: YearInReviewProps
): { id: SceneId; durationInFrames: number }[] {
  const scenes = sceneBeats(props);
  let total = 0;
  const starts = scenes.map(({ beats: b }) => {
    const start = Math.round(beats(total) * FPS);
    total += b;
    return start;
  });
  const end = Math.round(beats(total) * FPS);
  return scenes.map(({ id }, i) => {
    const last = i === scenes.length - 1;
    const next = last ? end : starts[i + 1];
    return {
      id,
      durationInFrames: next - starts[i] + (last ? 0 : TRANSITION_FRAMES),
    };
  });
}

/**
 * Instagram posts a Story longer than this as several clips, so the full
 * video (every optional scene included) is kept under it.
 */
export const MAX_SECONDS = 60;

export function getDurationInFrames(props: YearInReviewProps): number {
  const scenes = getScenes(props);
  const total = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  return total - TRANSITION_FRAMES * (scenes.length - 1);
}
