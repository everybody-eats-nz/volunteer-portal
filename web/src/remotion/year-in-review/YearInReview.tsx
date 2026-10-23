import type { ComponentType } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { AbsoluteFill } from "remotion";
import { bandWipe } from "./components/band-wipe";
import { Music, Sound } from "./components/sound";
import { Achievements } from "./scenes/Achievements";
import { Crew } from "./scenes/Crew";
import { Docket } from "./scenes/Docket";
import { Intro } from "./scenes/Intro";
import { Meals } from "./scenes/Meals";
import { Outro } from "./scenes/Outro";
import { Rhythm } from "./scenes/Rhythm";
import { Roles } from "./scenes/Roles";
import { Shifts } from "./scenes/Shifts";
import { TopPercent } from "./scenes/TopPercent";
import { Together } from "./scenes/Together";
import type { YearInReviewProps } from "./schema";
import { colors, sceneColors } from "./theme";
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

// The wipe eases each band itself.
const transitionTiming = linearTiming({ durationInFrames: TRANSITION_FRAMES });

const BAND_COLORS = [
  colors.sun,
  colors.forest500,
  colors.cream,
  colors.forest700,
];

/** Two brand colours that differ from both scenes, to lead the next one in. */
const bandsBetween = (from: SceneId, to: SceneId) =>
  BAND_COLORS.filter(
    (c) =>
      c !== sceneColors[from].background && c !== sceneColors[to].background
  ).slice(0, 2);

/**
 * A volunteer's year as a vertical story: one scene per stat, each sweeping
 * up over the last behind bands of brand colour.
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
              {/* The bands sweeping the next scene in. */}
              {i > 0 && <Sound name="whoosh" at={0.05} volume={0.35} />}
            </TransitionSeries.Sequence>
          );
          return i === 0
            ? [scene]
            : [
                <TransitionSeries.Transition
                  key={`${id}-in`}
                  presentation={bandWipe({
                    bands: bandsBetween(scenes[i - 1].id, id),
                  })}
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
