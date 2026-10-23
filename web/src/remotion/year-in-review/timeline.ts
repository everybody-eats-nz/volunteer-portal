import type { YearInReviewProps } from "./schema";

export const FPS = 30;

/** Frames each scene overlaps the next while it wipes in. */
export const TRANSITION_FRAMES = 24;

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

const seconds = (s: number) => Math.round(s * FPS);

/**
 * The scenes this volunteer's video plays, in order. Stories with nothing to
 * say (no friends on shift, no new badges) are left out rather than shown
 * empty, and the video gets shorter.
 */
export function getScenes(
  props: YearInReviewProps
): { id: SceneId; durationInFrames: number }[] {
  const scenes: { id: SceneId; seconds: number; show: boolean }[] = [
    { id: "intro", seconds: 4.5, show: true },
    { id: "shifts", seconds: 5.5, show: true },
    { id: "meals", seconds: 5.5, show: props.impact.mealsServed > 0 },
    { id: "rhythm", seconds: 6, show: true },
    { id: "roles", seconds: 5.5, show: props.roles.length > 0 },
    { id: "crew", seconds: 5.5, show: props.crew.alongside > 0 },
    { id: "achievements", seconds: 5.5, show: props.achievements.length > 0 },
    { id: "topPercent", seconds: 4.5, show: props.topPercent !== null },
    { id: "together", seconds: 6.5, show: true },
    { id: "docket", seconds: 7, show: true },
    { id: "outro", seconds: 5, show: true },
  ];
  return scenes
    .filter((scene) => scene.show)
    .map(({ id, seconds: s }) => ({ id, durationInFrames: seconds(s) }));
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
