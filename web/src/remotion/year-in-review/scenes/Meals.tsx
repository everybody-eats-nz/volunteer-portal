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
  useBeatPulse,
  Words,
} from "../components/motion";
import { Odometer } from "../components/odometer";
import { PhotoPlate } from "../components/plate";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, formatNumber, layout } from "../theme";
import { beats } from "../timeline";

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
const PHOTO = 480;
/** The count lands on beat three. */
const COUNT_LANDS = beats(3);

/** The line drawing inks itself in from the left, then drifts. */
const Kawakawa = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drawn = interpolate(frame, [0.1 * fps, 1.5 * fps], [0, 100], {
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

const Count = ({ value }: { readonly value: number }) => {
  const pulse = useBeatPulse(COUNT_LANDS + 0.1);
  return (
    <div
      style={{
        ...display(fitFontSize(formatNumber(value), 360, undefined, 0.6)),
        color: colors.forest500,
        marginTop: 28,
        scale: `${pulse}`,
        transformOrigin: "left center",
      }}
    >
      <Odometer value={value} start={0.4} land={COUNT_LANDS} />
    </div>
  );
};

export const Meals = ({ impact }: YearInReviewProps) => (
  <Scene
    id="meals"
    backdrop={
      <>
        <Kawakawa />
        {/* Food on the table, served over the bottom edge. */}
        <PhotoPlate
          photo="community-table"
          size={PHOTO}
          delay={0.9}
          style={{
            position: "absolute",
            right: layout.gutter,
            bottom: 110,
          }}
        />
      </>
    }
    style={{ paddingTop: CONTENT_TOP }}
  >
    <Words
      text="On your nights, the whānau served"
      delay={0.05}
      stagger={0.05}
      style={lead}
    />
    <Count value={impact.mealsServed} />
    <Words
      text={[{ italic: "meals" }]}
      delay={0.5}
      style={{ ...display(160), marginTop: 0 }}
    />
    <Rise delay={COUNT_LANDS + 0.25} style={{ marginTop: 48 }}>
      <div style={{ ...body, maxWidth: 560 }}>
        That&apos;s about {formatNumber(impact.foodSavedKg)} kg of rescued food
        cooked up instead of thrown out.
      </div>
    </Rise>
  </Scene>
);
