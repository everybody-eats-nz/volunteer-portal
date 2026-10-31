import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, easeOut, Rise, Scene, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";

// The marketing site's dining-room mural (marketing-cms
// public/patterns/dining-room.avif): line-work on transparency, used as a
// mask so it takes any colour, as the site does. WebP rather than AVIF for
// the app's iOS WebView, with the alpha cut to 8 levels (93 KB against
// 169 KB, no visible difference).
const MURAL = staticFile("patterns/dining-room.webp");
const MURAL_WIDTH = 1200;
const MURAL_HEIGHT = Math.round((MURAL_WIDTH / 1280) * 759);
/** The mural's bottom edge; it runs on behind Instagram's caption. */
const MURAL_BOTTOM = layout.height - 70;

/**
 * A full Everybody Eats dining room, drawn in as if the lights were coming
 * on from the middle of the room.
 */
const DiningRoom = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lit = interpolate(frame, [0.3 * fps, 2 * fps], [0, 78], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: (layout.width - MURAL_WIDTH) / 2,
        top: MURAL_BOTTOM - MURAL_HEIGHT,
        width: MURAL_WIDTH,
        height: MURAL_HEIGHT,
        backgroundColor: colors.cream,
        maskImage: `url(${MURAL})`,
        WebkitMaskImage: `url(${MURAL})`,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        clipPath: `circle(${lit}% at 50% 60%)`,
      }}
    >
      {/* Holds the render until the mask has loaded. */}
      <Img src={MURAL} style={{ display: "none" }} />
    </div>
  );
};

export const Outro = ({ firstName, year }: YearInReviewProps) => {
  const thanks = `Ngā mihi, ${firstName}`;

  return (
    <Scene
      id="outro"
      backdrop={<DiningRoom />}
      style={{ alignItems: "center", textAlign: "center" }}
    >
      {/* A shimmer as the room lights up. */}
      <Sound name="bloom" at={0.3} volume={0.22} />
      <Words
        text={["Ngā mihi,", { italic: firstName }]}
        delay={0.05}
        style={{
          ...display(fitFontSize(thanks, 150, undefined, 0.46, 104)),
          marginTop: 40,
        }}
      />
      <Rise delay={0.5} style={{ marginTop: 36 }}>
        <div style={{ ...lead, color: colors.forest200 }}>
          See you in the kitchen in {year + 1}.
        </div>
      </Rise>
      <Rise delay={1.1} distance={30} style={{ marginTop: 64 }}>
        <Img src={staticFile("logo.svg")} style={{ width: 260 }} />
        <div style={{ ...lead, color: colors.sun, marginTop: 20 }}>
          everybodyeats.nz
        </div>
      </Rise>
    </Scene>
  );
};
