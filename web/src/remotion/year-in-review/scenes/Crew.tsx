import { useState } from "react";
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  clamp,
  Pop,
  Rise,
  Scene,
  useSquash,
  Words,
} from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts, formatNumber, layout } from "../theme";
import { beats } from "../timeline";

const AVATAR = 190;

/** Most people drawn in the crowd; beyond this each dot stands for more. */
const MAX_DOTS = 420;
const BLOOM_RADIUS = 720;
const BLOOM_CENTRE = { x: layout.width / 2, y: 660 };
const BLOOM_START = 0.15;
/** The last dot opens on beat three. */
const BLOOM_END = beats(3);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Seconds into the scene that dot `i` of `dots` appears. */
const bloomsAt = (i: number, dots: number) =>
  BLOOM_START +
  (dots > 1 ? Math.sqrt(i / (dots - 1)) * (BLOOM_END - BLOOM_START) : 0);

/**
 * Everyone they worked alongside, one dot each, opening out from the middle
 * in a sunflower spiral until it fills the frame.
 */
const Crowd = ({ dots }: { readonly dots: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spacing = Math.min(52, BLOOM_RADIUS / Math.sqrt(dots));
  const size = spacing * 0.6;

  return (
    <>
      {Array.from({ length: dots }, (_, i) => {
        const r = spacing * Math.sqrt(i + 0.5);
        const a = i * GOLDEN_ANGLE;
        const appear = spring({
          frame,
          fps,
          delay: bloomsAt(i, dots) * fps,
          config: { damping: 11, stiffness: 170 },
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: BLOOM_CENTRE.x + r * Math.cos(a) - size / 2,
              top: BLOOM_CENTRE.y + r * Math.sin(a) - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: colors.forest200,
              opacity: 0.4,
              scale: `${appear}`,
            }}
          />
        );
      })}
    </>
  );
};

/** Counts up as the crowd fills in, squashing as the last dot opens. */
const CrowdCount = ({
  value,
  dots,
}: {
  readonly value: number;
  readonly dots: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = frame / fps;
  // Invert bloomsAt: how many dots are out by now.
  const shown = interpolate(seconds, [BLOOM_START, BLOOM_END], [0, 1], clamp);
  const current = Math.round(value * shown * shown);
  const squash = useSquash(BLOOM_END, 0.16);

  return (
    <div
      style={{
        ...display(value >= 1000 ? 340 : value >= 100 ? 420 : 500),
        color: colors.sun,
        marginTop: 20,
        fontVariantNumeric: "tabular-nums",
        scale: `1 ${squash}`,
        transformOrigin: "left bottom",
      }}
    >
      {formatNumber(Math.min(value, Math.max(dots > 0 ? 1 : 0, current)))}
    </div>
  );
};

const Avatar = ({
  name,
  photoUrl,
}: {
  readonly name: string;
  readonly photoUrl: string | null;
}) => {
  // A photo that won't load falls back to the initial rather than failing
  // the whole render.
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: "50%",
        overflow: "hidden",
        border: `8px solid ${colors.paper}`,
        backgroundColor: colors.sun,
        color: colors.forest700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
        ...display(100),
      }}
    >
      {photoUrl && !failed ? (
        <Img
          src={photoUrl}
          maxRetries={1}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        name[0]?.toUpperCase()
      )}
    </div>
  );
};

export const Crew = ({ crew }: YearInReviewProps) => {
  const dots = Math.min(crew.alongside, MAX_DOTS);
  const others = crew.alongside === 1 ? "volunteer" : "volunteers";

  return (
    <Scene id="crew" backdrop={<Crowd dots={dots} />}>
      <Sound name="bloom" at={BLOOM_START} volume={0.3} />
      <Words
        text="You cooked, served and scrubbed alongside"
        delay={0.05}
        stagger={0.04}
        style={{ ...lead, color: colors.forest200 }}
      />
      <CrowdCount value={crew.alongside} dots={dots} />
      <Words
        text={["other", { italic: others }]}
        delay={0.3}
        style={{ ...display(130), marginTop: -16 }}
      />
      <div style={{ flex: 1 }} />
      {crew.friends.length > 0 && (
        <>
          <Rise delay={BLOOM_END + 0.1}>
            <div style={{ ...body, fontWeight: 600, marginBottom: 32 }}>
              Your regular crew
            </div>
          </Rise>
          <div style={{ display: "flex", gap: 44 }}>
            {crew.friends.map((friend, i) => (
              <Pop key={friend.name} delay={BLOOM_END + 0.25 + i * 0.14}>
                <Avatar name={friend.name} photoUrl={friend.photoUrl} />
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontWeight: 700,
                    fontSize: 38,
                    marginTop: 18,
                    width: AVATAR,
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {friend.name}
                </div>
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontWeight: 500,
                    fontSize: 32,
                    color: colors.forest200,
                    width: AVATAR,
                    textAlign: "center",
                  }}
                >
                  {friend.nights} {friend.nights === 1 ? "night" : "nights"}
                </div>
              </Pop>
            ))}
          </div>
        </>
      )}
    </Scene>
  );
};
