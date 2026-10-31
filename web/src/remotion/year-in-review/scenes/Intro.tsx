import { useState } from "react";
import { Img, staticFile } from "remotion";
import { Pop, Rise, Scene, useSquash, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, layout } from "../theme";
import { beats } from "../timeline";

const LOGO_WIDTH = 250;
const AVATAR = 150;
const GREETING_MAX = 150;
const GREETING_MIN = 104;
/** Fraunces' average glyph width, generous so a wrap is never missed. */
const GREETING_CHAR_WIDTH = 0.46;
/** Seconds into the scene the year lands: beat two. */
const YEAR_LANDS = beats(2);

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

/** The year, as big as the frame allows, landing with a thump. */
const Year = ({ year }: { readonly year: number }) => {
  const squash = useSquash(YEAR_LANDS, 0.14);
  return (
    <div style={{ scale: `1 ${squash}`, transformOrigin: "50% 100%" }}>
      <Words
        text={String(year)}
        delay={YEAR_LANDS - 0.55}
        style={{
          ...display(
            fitFontSize(String(year), 440, layout.width - layout.gutter * 2, 0.55)
          ),
          color: colors.sun,
        }}
      />
      <Sound name="mouse-click" at={YEAR_LANDS} volume={0.3} />
    </div>
  );
};

export const Intro = ({ firstName, photoUrl, year }: YearInReviewProps) => {
  const greeting = `Kia ora, ${firstName}`;

  return (
    <Scene
      id="intro"
      reveal={0}
      style={{ alignItems: "center", textAlign: "center" }}
    >
      <Pop delay={0.2}>
        {photoUrl ? <ProfilePhoto photoUrl={photoUrl} /> : <Logo />}
      </Pop>
      <Words
        text={["Kia ora,", { italic: firstName }]}
        delay={0.4}
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
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Year year={year} />
      </div>
      <Rise delay={1.3}>
        <div style={{ ...lead, color: colors.forest200 }}>
          Here&apos;s your year in mahi
        </div>
      </Rise>
    </Scene>
  );
};
