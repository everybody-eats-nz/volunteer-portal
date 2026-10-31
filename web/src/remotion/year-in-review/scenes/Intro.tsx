import { useState } from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  clamp,
  Pop,
  Rise,
  Scene,
  useBeatPulse,
  useSquash,
  Words,
} from "../components/motion";
import { Plate } from "../components/plate";
import { RIM, type IrisOrigin } from "../components/plate-iris";
import { Sound } from "../components/sound";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";
import { beats, TRANSITION_FRAMES } from "../timeline";

const LOGO_WIDTH = 250;
const AVATAR = 150;
const GREETING_MAX = 150;
const GREETING_MIN = 104;
/** Fraunces' average glyph width, generous so a wrap is never missed. */
const GREETING_CHAR_WIDTH = 0.46;
const PLATE = 720;
const PLATE_CENTRE_Y = 1040;
/** Seconds into the scene the year lands on the plate: beat two. */
const YEAR_LANDS = beats(2);

/**
 * The plate the year is served on. The first scene cut opens from its
 * edge, so the plate grows into the next scene (`YearInReview`).
 */
export const INTRO_IRIS: IrisOrigin = {
  x: layout.width / 2,
  y: PLATE_CENTRE_Y,
  radius: PLATE / 2 - RIM,
};

const Logo = () => (
  <Img
    src={staticFile("logo.svg")}
    style={{ width: LOGO_WIDTH, display: "block" }}
  />
);

/**
 * The volunteer's profile photo in a white rim. One that won't load (an
 * expired sign-in photo, say) gives way to the logo in the same space
 * rather than failing the render.
 */
const ProfilePhoto = ({ photoUrl }: { readonly photoUrl: string }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{ height: AVATAR, display: "flex", alignItems: "center" }}>
        <Logo />
      </div>
    );
  }
  return (
    <div
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: "50%",
        overflow: "hidden",
        border: `8px solid ${colors.paper}`,
        backgroundColor: colors.paper,
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.35)",
      }}
    >
      <Img
        src={photoUrl}
        maxRetries={1}
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
};

/** The year, served: the plate is set down and the year rises up on it. */
const Served = ({ year }: { readonly year: number }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const land = spring({
    frame,
    fps,
    delay: 0.1 * fps,
    config: { damping: 13, stiffness: 110 },
  });
  const pulse = useBeatPulse(YEAR_LANDS + 0.1);
  const squash = useSquash(YEAR_LANDS, 0.14);
  // The plate is cleared just before the next scene grows out of it.
  const cleared = interpolate(
    frame,
    [durationInFrames - TRANSITION_FRAMES - 7, durationInFrames - TRANSITION_FRAMES],
    [1, 0],
    clamp
  );

  return (
    <Plate
      size={PLATE}
      style={{
        position: "absolute",
        left: (layout.width - PLATE) / 2,
        top: PLATE_CENTRE_Y - PLATE / 2,
        opacity: interpolate(land, [0, 0.2], [0, 1], clamp),
        scale: `${interpolate(land, [0, 1], [0.5, 1])}`,
      }}
    >
      <div
        style={{
          opacity: cleared,
          scale: `${pulse} ${pulse * squash}`,
          transformOrigin: "50% 100%",
        }}
      >
        <Words
          text={String(year)}
          delay={YEAR_LANDS - 0.55}
          style={display(fitFontSize(String(year), 220, PLATE * 0.64, 0.55))}
        />
        <Sound name="mouse-click" at={YEAR_LANDS} volume={0.3} />
      </div>
    </Plate>
  );
};

export const Intro = ({ firstName, photoUrl, year }: YearInReviewProps) => {
  const greeting = `Kia ora, ${firstName}`;

  return (
    <Scene
      id="intro"
      reveal={0}
      backdrop={
        <>
          <Served year={year} />
          <Sound name="plate-down" at={0.32} volume={0.5} />
        </>
      }
      style={{ alignItems: "center", textAlign: "center" }}
    >
      <Pop delay={0.2}>
        {photoUrl ? <ProfilePhoto photoUrl={photoUrl} /> : <Logo />}
      </Pop>
      <Words
        text={["Kia ora,", { italic: firstName }]}
        delay={0.45}
        style={{
          ...display(
            fitFontSize(
              greeting,
              GREETING_MAX,
              undefined,
              GREETING_CHAR_WIDTH,
              GREETING_MIN
            )
          ),
          marginTop: 36,
        }}
      />
      <Rise delay={1.3} style={{ marginTop: "auto" }}>
        <div style={{ ...lead, color: colors.forest200 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
    </Scene>
  );
};
