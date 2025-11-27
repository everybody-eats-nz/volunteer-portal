import { AbsoluteFill, Sequence } from "remotion";
import { IntroSlide } from "./slides/IntroSlide";
import { StatsSlide } from "./slides/StatsSlide";
import { ImpactSlide } from "./slides/ImpactSlide";
import { AchievementsSlide } from "./slides/AchievementsSlide";
import { StreakSlide } from "./slides/StreakSlide";
import { FriendsSlide } from "./slides/FriendsSlide";
import { HighlightsSlide } from "./slides/HighlightsSlide";
import { OutroSlide } from "./slides/OutroSlide";
import { SLIDE_TIMING, SLIDE_START_FRAMES, type YearStats } from "./types";

export const YearInReview: React.FC<YearStats> = (stats) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a1a1a" }}>
      {/* Slide 1: Intro (3s) */}
      <Sequence from={SLIDE_START_FRAMES.intro} durationInFrames={SLIDE_TIMING.intro}>
        <IntroSlide {...stats} />
      </Sequence>

      {/* Slide 2: Stats Overview (4s) */}
      <Sequence from={SLIDE_START_FRAMES.stats} durationInFrames={SLIDE_TIMING.stats}>
        <StatsSlide {...stats} />
      </Sequence>

      {/* Slide 3: Impact (4s) */}
      <Sequence from={SLIDE_START_FRAMES.impact} durationInFrames={SLIDE_TIMING.impact}>
        <ImpactSlide {...stats} />
      </Sequence>

      {/* Slide 4: Achievements (5s) */}
      <Sequence from={SLIDE_START_FRAMES.achievements} durationInFrames={SLIDE_TIMING.achievements}>
        <AchievementsSlide {...stats} />
      </Sequence>

      {/* Slide 5: Streak (3s) */}
      <Sequence from={SLIDE_START_FRAMES.streak} durationInFrames={SLIDE_TIMING.streak}>
        <StreakSlide {...stats} />
      </Sequence>

      {/* Slide 6: Friends (3s) */}
      <Sequence from={SLIDE_START_FRAMES.friends} durationInFrames={SLIDE_TIMING.friends}>
        <FriendsSlide {...stats} />
      </Sequence>

      {/* Slide 7: Highlights (5s) */}
      <Sequence from={SLIDE_START_FRAMES.highlights} durationInFrames={SLIDE_TIMING.highlights}>
        <HighlightsSlide {...stats} />
      </Sequence>

      {/* Slide 8: Outro (3s) */}
      <Sequence from={SLIDE_START_FRAMES.outro} durationInFrames={SLIDE_TIMING.outro}>
        <OutroSlide {...stats} />
      </Sequence>
    </AbsoluteFill>
  );
};
