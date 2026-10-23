import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Rise, Scene, SlotNumber, Words } from "../components/motion";
import { PhotoCard } from "../components/photo";
import { Plate } from "../components/plate";
import { Sound } from "../components/sound";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";

/** Roughly where "Here's your year in mahi" ends. */
const TEXT_BOTTOM = 660;
const PHOTO_TOP = TEXT_BOTTOM + 56;
const PHOTO_HEIGHT = 540;
const PLATE = 540;
/** The plate comes to rest over the photo's bottom edge. */
const PLATE_CENTRE_Y = PHOTO_TOP + PHOTO_HEIGHT + 40;

/**
 * The middle of the photo above the plate, as a share of the frame's
 * height: the web player puts its play button here.
 */
export const INTRO_GAP_CENTRE =
  (PHOTO_TOP + PLATE_CENTRE_Y - PLATE / 2) / 2 / layout.height;

/** The year, served: the plate slides in across the pass and settles. */
const Served = ({ year }: { readonly year: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({
    frame,
    fps,
    delay: 0.3 * fps,
    durationInFrames: 1.2 * fps,
    config: { damping: 200 },
  });

  return (
    <Plate
      size={PLATE}
      style={{
        position: "absolute",
        left: (layout.width - PLATE) / 2,
        top: PLATE_CENTRE_Y - PLATE / 2,
        translate: `${interpolate(slide, [0, 1], [layout.width, 0])}px 0px`,
        rotate: `${interpolate(slide, [0, 1], [40, 0])}deg`,
      }}
    >
      <SlotNumber
        // Plain digits: a year has no thousands separator.
        value={year}
        grouping={false}
        delay={0.7}
        duration={1.5}
        style={display(fitFontSize(String(year), 220, PLATE * 0.8, 0.55))}
      />
    </Plate>
  );
};

export const Intro = ({ firstName, year }: YearInReviewProps) => {
  const greeting = `Kia ora, ${firstName}`;

  return (
    <Scene
      id="intro"
      reveal={0}
      backdrop={
        <>
          {/* A volunteer carrying plates out, face out of frame. */}
          <PhotoCard
            photo="serving-plates"
            delay={0.15}
            focus="center 35%"
            style={{
              position: "absolute",
              left: layout.gutter,
              top: PHOTO_TOP,
              width: layout.width - layout.gutter * 2,
              height: PHOTO_HEIGHT,
            }}
          />
          <Served year={year} />
          <Sound name="whip" at={0.35} volume={0.3} />
          <Sound name="plate-down" at={1.05} volume={0.45} />
        </>
      }
      style={{ alignItems: "center", textAlign: "center" }}
    >
      <Rise delay={0.1} distance={30}>
        <Img
          src={staticFile("everybody-eats-logo.svg")}
          style={{ width: 280 }}
        />
      </Rise>
      <Words
        text={["Kia ora,", { italic: firstName }]}
        delay={0.25}
        style={{
          ...display(fitFontSize(greeting, 150, undefined, 0.46, 104)),
          marginTop: 72,
        }}
      />
      <Rise delay={0.7} style={{ marginTop: 28 }}>
        <div style={{ ...lead, color: colors.forest500 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
    </Scene>
  );
};
