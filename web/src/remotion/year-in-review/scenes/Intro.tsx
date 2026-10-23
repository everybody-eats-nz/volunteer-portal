import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Rise, Scene, SlotNumber, Words } from "../components/motion";
import { Plate } from "../components/plate";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";

const PLATE = 620;
/** Where the plate comes to rest; its bottom edge clears Instagram's UI. */
const PLATE_CENTRE_Y = layout.height - layout.marginBottom - PLATE / 2;
/** Roughly where "Here's your year in mahi" ends. */
const TEXT_BOTTOM = 660;

/**
 * The middle of the gap between the greeting and the plate, as a share of
 * the frame's height: the web player puts its play button here.
 */
export const INTRO_GAP_CENTRE =
  (TEXT_BOTTOM + PLATE_CENTRE_Y - PLATE / 2) / 2 / layout.height;

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
        style={display(fitFontSize(String(year), 250, PLATE * 0.78, 0.55))}
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
      backdrop={<Served year={year} />}
      style={{ alignItems: "center", textAlign: "center" }}
    >
      <Rise delay={0.1} distance={30}>
        <Img src={staticFile("logo.svg")} style={{ width: 280 }} />
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
        <div style={{ ...lead, color: colors.forest200 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
      {/* The player's play button waits in the gap above the plate. */}
    </Scene>
  );
};
