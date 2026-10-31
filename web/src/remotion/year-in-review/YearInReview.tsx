import type { ComponentType } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { plateIris } from "./components/plate-iris";
import { Music, Sound } from "./components/sound";
import { Achievements } from "./scenes/Achievements";
import { Crew } from "./scenes/Crew";
import { Docket } from "./scenes/Docket";
import { Intro, INTRO_IRIS } from "./scenes/Intro";
import { Meals } from "./scenes/Meals";
import { Outro } from "./scenes/Outro";
import { Rhythm } from "./scenes/Rhythm";
import { Roles } from "./scenes/Roles";
import { Shifts } from "./scenes/Shifts";
import { TopPercent } from "./scenes/TopPercent";
import { Together } from "./scenes/Together";
import type { YearInReviewProps } from "./schema";
import {
  getDurationInFrames,
  getScenes,
  type SceneId,
  TRANSITION_FRAMES,
} from "./timeline";

const SCENES: Record<
  SceneId,
  { name: string; Component: ComponentType<YearInReviewProps> }
> = {
  intro: { name: "Intro", Component: Intro },
  shifts: { name: "Shifts", Component: Shifts },
  meals: { name: "Meals", Component: Meals },
  rhythm: { name: "Rhythm", Component: Rhythm },
  roles: { name: "Roles", Component: Roles },
  crew: { name: "Crew", Component: Crew },
  achievements: { name: "Achievements", Component: Achievements },
  topPercent: { name: "Top percent", Component: TopPercent },
  together: { name: "Together", Component: Together },
  docket: { name: "Docket", Component: Docket },
  outro: { name: "Outro", Component: Outro },
};

// The iris eases itself.
const transitionTiming = linearTiming({ durationInFrames: TRANSITION_FRAMES });

/**
 * A volunteer's year as a vertical story, one scene per stat. Each scene is
 * set down over the last as a plate: a white-rimmed circle that opens from
 * the middle of the frame on the beat. The first opens from the plate the
 * intro serves the year on, so that plate becomes the whole video.
 */
export const YearInReview = (props: YearInReviewProps) => {
  const scenes = getScenes(props);
  return (
    <AbsoluteFill>
      <TransitionSeries>
        {scenes.flatMap(({ id, durationInFrames }, i) => {
          const { name, Component } = SCENES[id];
          const scene = (
            <TransitionSeries.Sequence
              key={id}
              name={name}
              durationInFrames={durationInFrames}
            >
              <Component {...props} />
              {/* The plate being set down over the last scene. */}
              {i > 0 && <Sound name="whip" at={0} volume={0.28} />}
            </TransitionSeries.Sequence>
          );
          return i === 0
            ? [scene]
            : [
                <TransitionSeries.Transition
                  key={`${id}-in`}
                  presentation={plateIris(
                    scenes[i - 1].id === "intro" ? { from: INTRO_IRIS } : {}
                  )}
                  timing={transitionTiming}
                />,
                scene,
              ];
        })}
      </TransitionSeries>
      <Music durationInFrames={getDurationInFrames(props)} />
    </AbsoluteFill>
  );
};
