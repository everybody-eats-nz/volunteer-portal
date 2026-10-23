import { useState } from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Pop, Rise, Scene, SlotNumber, Words } from "../components/motion";
import { PhotoCard } from "../components/photo";
import { Plate } from "../components/plate";
import { Sound } from "../components/sound";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";

const LOGO_WIDTH = 280;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH / 179) * 65);
const AVATAR = 200;
const HEADER_GAP = 56;
const GREETING_MAX = 150;
const GREETING_MIN = 104;
/** Fraunces' average glyph width, generous so a wrap is never missed. */
const GREETING_CHAR_WIDTH = 0.46;
const LEAD_GAP = 28;
const PHOTO_GAP = 56;
/** The photo card ends here whatever sits above it. */
const PHOTO_BOTTOM = 1256;
const PLATE = 540;
/** The plate comes to rest over the photo's bottom edge. */
const PLATE_CENTRE_Y = PHOTO_BOTTOM + 40;

const greetingFor = (firstName: string) => `Kia ora, ${firstName}`;

/**
 * Where the intro's pieces land for this volunteer. The text block grows
 * with their photo and a name long enough to wrap, and the serving photo
 * starts below it, so the photo shortens rather than the text running into
 * it. The plate always lands in the same place.
 */
function introLayout({
  firstName,
  photoUrl,
}: Pick<YearInReviewProps, "firstName" | "photoUrl">) {
  const greeting = greetingFor(firstName);
  const greetingSize = fitFontSize(
    greeting,
    GREETING_MAX,
    undefined,
    GREETING_CHAR_WIDTH,
    GREETING_MIN
  );
  const lines = Math.ceil(
    (greeting.length * GREETING_CHAR_WIDTH * greetingSize) /
      (layout.width - layout.gutter * 2)
  );
  const textBottom =
    layout.marginTop +
    (photoUrl ? AVATAR : LOGO_HEIGHT) +
    HEADER_GAP +
    lines * greetingSize * Number(display(greetingSize).lineHeight) +
    LEAD_GAP +
    Number(lead.fontSize) * Number(lead.lineHeight);
  const photoTop = textBottom + PHOTO_GAP;

  return { greetingSize, photoTop, photoHeight: PHOTO_BOTTOM - photoTop };
}

/**
 * The middle of the photo above the plate, as a share of the frame's
 * height: the web player puts its play button here.
 */
export function introGapCentre(
  props: Pick<YearInReviewProps, "firstName" | "photoUrl">
): number {
  const { photoTop } = introLayout(props);
  return (photoTop + PLATE_CENTRE_Y - PLATE / 2) / 2 / layout.height;
}

const Logo = () => (
  <Img
    src={staticFile("everybody-eats-logo.svg")}
    style={{ width: LOGO_WIDTH, display: "block" }}
  />
);

/**
 * The volunteer's profile photo on a plate's white rim. One that won't load
 * (an expired sign-in photo, say) gives way to the logo in the same space
 * rather than failing the render.
 */
const ProfilePhoto = ({ photoUrl }: { readonly photoUrl: string }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{ height: AVATAR, display: "flex", alignItems: "center" }}
      >
        <Logo />
      </div>
    );
  }
  return (
    <Pop delay={0.1}>
      <div
        style={{
          width: AVATAR,
          height: AVATAR,
          borderRadius: "50%",
          overflow: "hidden",
          border: `10px solid ${colors.paper}`,
          backgroundColor: colors.paper,
          boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
        }}
      >
        <Img
          src={photoUrl}
          maxRetries={1}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    </Pop>
  );
};

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

export const Intro = ({ firstName, photoUrl, year }: YearInReviewProps) => {
  const { greetingSize, photoTop, photoHeight } = introLayout({
    firstName,
    photoUrl,
  });

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
              top: photoTop,
              width: layout.width - layout.gutter * 2,
              height: photoHeight,
            }}
          />
          <Served year={year} />
          <Sound name="whip" at={0.35} volume={0.3} />
          <Sound name="plate-down" at={1.05} volume={0.45} />
        </>
      }
      style={{ alignItems: "center", textAlign: "center" }}
    >
      {photoUrl ? (
        <ProfilePhoto photoUrl={photoUrl} />
      ) : (
        <Rise delay={0.1} distance={30}>
          <Logo />
        </Rise>
      )}
      <Words
        text={["Kia ora,", { italic: firstName }]}
        delay={0.25}
        style={{
          ...display(greetingSize),
          marginTop: HEADER_GAP,
        }}
      />
      <Rise delay={0.7} style={{ marginTop: LEAD_GAP }}>
        <div style={{ ...lead, color: colors.forest500 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
    </Scene>
  );
};
