import { useState } from "react";
import {
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, Pop, Rise, Scene, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fonts, formatNumber, layout } from "../theme";

const AVATAR = 200;

/** Most people drawn in the crowd; beyond this each dot stands for more. */
const MAX_DOTS = 420;
const BLOOM_RADIUS = 620;
const BLOOM_CENTRE = { x: layout.width / 2, y: 640 };
const BLOOM_START = 0.2;
const BLOOM_SECONDS = 1.8;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Seconds into the scene that dot `i` of `dots` appears. */
const bloomsAt = (i: number, dots: number) =>
  BLOOM_START + (dots > 1 ? Math.sqrt(i / (dots - 1)) * BLOOM_SECONDS : 0);

/**
 * Everyone they worked alongside, one dot each, opening out from the middle
 * in a sunflower spiral.
 */
const Crowd = ({ dots }: { readonly dots: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spacing = Math.min(46, BLOOM_RADIUS / Math.sqrt(dots));
  const size = spacing * 0.62;

  return (
    <>
      {Array.from({ length: dots }, (_, i) => {
        const r = spacing * Math.sqrt(i + 0.5);
        const a = i * GOLDEN_ANGLE;
        const appear = spring({
          frame,
          fps,
          delay: bloomsAt(i, dots) * fps,
          config: { damping: 12, stiffness: 160 },
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
              backgroundColor: colors.forest500,
              scale: appear,
            }}
          />
        );
      })}
    </>
  );
};

/** Counts up as the crowd fills in. */
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
  const shown = interpolate(
    seconds,
    [BLOOM_START, BLOOM_START + BLOOM_SECONDS],
    [0, 1],
    clamp
  );
  const current = Math.round(value * shown * shown);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatNumber(Math.min(value, Math.max(dots > 0 ? 1 : 0, current)))}
    </span>
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
        border: `6px solid ${colors.sun}`,
        outline: `6px solid ${colors.forest700}`,
        backgroundColor: colors.sun,
        color: colors.forest700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...display(110),
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
  const others = `other ${crew.alongside === 1 ? "volunteer" : "volunteers"}`;

  return (
    <Scene id="crew" backdrop={<Crowd dots={dots} />}>
      <Sound name="bloom" at={BLOOM_START} volume={0.3} />
      <Rise delay={0}>
        <div style={{ ...lead, color: colors.forest200 }}>
          You cooked, served and scrubbed alongside
        </div>
      </Rise>
      <div
        style={{
          ...display(
            crew.alongside >= 1000 ? 340 : crew.alongside >= 100 ? 420 : 500
          ),
          color: colors.sun,
          marginTop: 24,
        }}
      >
        <CrowdCount value={crew.alongside} dots={dots} />
      </div>
      <Words
        text={["other", { italic: others.replace(/^other /, "") }]}
        delay={0.3}
        style={display(130)}
      />
      <div style={{ flex: 1 }} />
      {crew.friends.length > 0 && (
        <>
          <Rise delay={1.9}>
            <div style={{ ...body, fontWeight: 600, marginBottom: 40 }}>
              Your regular crew
            </div>
          </Rise>
          <div style={{ display: "flex", gap: 48 }}>
            {crew.friends.map((friend, i) => (
              <Pop key={friend.name} delay={2.1 + i * 0.15}>
                <Avatar name={friend.name} photoUrl={friend.photoUrl} />
                <div
                  style={{
                    fontFamily: fonts.body,
                    fontWeight: 700,
                    fontSize: 40,
                    marginTop: 20,
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
                    fontSize: 34,
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
