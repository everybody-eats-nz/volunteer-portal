import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  clamp,
  Drift,
  easeOut,
  Rise,
  Scene,
  SlotNumber,
  Words,
} from "../components/motion";
import { PhotoCard } from "../components/photo";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, formatNumber, layout } from "../theme";

// The kawakawa illustration is 1316 x 484, cropped along its top edge to
// hang from the top of a page. It hangs from the top of the frame the same
// way, so the crop meets the frame edge instead of slicing through the
// drawings mid-frame. Shown a little wider than the frame so it can drift
// without revealing an edge. WebP rather than the site's AVIF, which the
// iOS WebView the app plays the video in fails to decode.
const BAND_WIDTH = 1300;
const BAND_HEIGHT = Math.round((BAND_WIDTH / 1316) * 484);
const BAND_LEFT = -40;
/** The text starts just below the lowest drawing in the band. */
const CONTENT_TOP = BAND_HEIGHT - 10;

/** The line drawing inks itself in from the left, then drifts. */
const Kawakawa = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drawn = interpolate(frame, [0.5 * fps, 2.4 * fps], [0, 100], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: BAND_LEFT,
        top: 0,
        clipPath: `inset(0 ${100 - drawn}% 0 0)`,
      }}
    >
      {/* Ends with the band's right edge on the frame's. */}
      <Drift pixels={BAND_WIDTH + BAND_LEFT - layout.width}>
        <Img
          src={staticFile("patterns/kawakawa.webp")}
          style={{ width: BAND_WIDTH, height: BAND_HEIGHT }}
        />
      </Drift>
    </div>
  );
};

export const Meals = ({ impact }: YearInReviewProps) => (
  <Scene id="meals" backdrop={<Kawakawa />} style={{ paddingTop: CONTENT_TOP }}>
    <Words
      text="On your nights, the whānau served"
      stagger={0.05}
      style={lead}
    />
    <div
      style={{
        ...display(
          fitFontSize(formatNumber(impact.mealsServed), 360, undefined, 0.6)
        ),
        color: colors.forest500,
        marginTop: 32,
      }}
    >
      <SlotNumber value={impact.mealsServed} delay={0.2} duration={1.9} />
    </div>
    <Words
      text={[{ italic: "meals" }]}
      delay={0.4}
      style={{ ...display(160), marginTop: 0 }}
    />
    <Rise delay={1.9} style={{ marginTop: 56 }}>
      <div style={body}>
        That&apos;s about {formatNumber(impact.foodSavedKg)} kg of rescued food
        cooked up instead of thrown out.
      </div>
    </Rise>
    <PhotoCard
      photo="community-table"
      // Arrives with the count, not after it, so the scene builds as one.
      delay={0.6}
      style={{
        flex: 1,
        minHeight: 0,
        marginTop: 56,
        // Runs on behind Instagram's caption, stopping short of the edge.
        marginBottom: -(layout.marginBottom - 70),
      }}
    />
  </Scene>
);
