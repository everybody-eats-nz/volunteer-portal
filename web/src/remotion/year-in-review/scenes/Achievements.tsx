import {
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { clamp, CountUp, Rise, Scene } from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, italic, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts, layout } from "../theme";

const SHOWN = 5;
const CARD = { width: 320, height: 430 };
/** The cards' top edge, and how far below it the pin they fan from sits. */
const CARDS_TOP = 730;
const PIVOT = CARD.height * 1.5;
/** Degrees between neighbouring cards once the hand is open, and how far
 * each slides sideways on top of the turn, so every badge stays in view. */
const SPREAD = 15;
const SLIDE = 60;
/** Seconds into the scene the hand starts to fan open. */
const FAN_FROM = 0.7;
const FAN_STAGGER = 0.09;

/**
 * One badge, a card in the hand. All the cards start stacked square behind
 * the middle one, then each swings out to its place about a pin below the
 * hand, nearest the middle first, with a ting as it settles.
 */
const Card = ({
  icon,
  name,
  index,
  count,
}: {
  readonly icon: string;
  readonly name: string;
  readonly index: number;
  readonly count: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mid = (count - 1) / 2;
  const offset = index - mid;
  const rank = Math.abs(offset);
  const start = (FAN_FROM + rank * FAN_STAGGER) * fps;
  const fan = spring({
    frame,
    fps,
    delay: start,
    config: { damping: 13, stiffness: 95 },
  });
  const lift = spring({
    frame,
    fps,
    delay: 0.3 * fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <div
      style={{
        position: "absolute",
        left: layout.width / 2 - CARD.width / 2,
        top: CARDS_TOP,
        width: CARD.width,
        height: CARD.height,
        transformOrigin: `50% ${PIVOT}px`,
        rotate: `${offset * SPREAD * fan}deg`,
        translate: `${offset * SLIDE * fan}px ${(1 - lift) * 160}px`,
        opacity: interpolate(lift, [0, 0.3], [0, 1], clamp),
        // The middle card sits on top; the hand stacks outward from it.
        zIndex: count - Math.ceil(rank),
        borderRadius: 26,
        backgroundColor: colors.paper,
        border: `3px solid ${colors.forest200}`,
        boxShadow: "0 18px 36px rgba(14, 42, 28, 0.22)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 20px 0",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 132, lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          fontFamily: fonts.body,
          fontWeight: 700,
          fontSize: 30,
          lineHeight: 1.15,
          marginTop: 28,
          color: colors.forest700,
          textWrap: "balance",
        }}
      >
        {name}
      </div>
    </div>
  );
};

const CONFETTI = 90;
const CONFETTI_AT = 0.3;
const CONFETTI_COLORS = [
  colors.forest500,
  colors.sun,
  colors.forest700,
  colors.peach,
];

/**
 * A burst of confetti thrown up from below the frame, falling and fluttering
 * under gravity. Seeded, so every render throws it the same way.
 */
const Confetti = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - CONFETTI_AT;
  if (t < 0) return null;

  return (
    <>
      {Array.from({ length: CONFETTI }, (_, i) => {
        const seed = (k: string) => random(`confetti-${i}-${k}`);
        const fromLeft = seed("side") < 0.5;
        const x0 = fromLeft ? -40 : layout.width + 40;
        const y0 = layout.height * (0.55 + seed("y") * 0.2);
        const speed = 1100 + seed("speed") * 800;
        // Thrown up and in towards the middle, up to 40 degrees off vertical.
        const lean = (fromLeft ? 1 : -1) * (0.1 + seed("angle") * 0.6);
        const vx = Math.sin(lean) * speed;
        const vy = -Math.cos(lean) * speed;
        // Air drag slows the throw, gravity takes over, paper flutters.
        const drag = 1.6;
        const decay = (1 - Math.exp(-drag * t)) / drag;
        const x = x0 + vx * decay + Math.sin(t * 7 + i) * 30;
        const y = y0 + vy * decay + 1400 * t * t * 0.5;
        const w = 16 + seed("w") * 14;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: w * 0.45,
              borderRadius: 3,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              rotate: `${t * (200 + seed("spin") * 400) * (i % 2 ? 1 : -1)}deg`,
              // Tumbling: the strip turns edge-on and back.
              scale: `1 ${Math.cos(t * (6 + seed("tumble") * 8))}`,
            }}
          />
        );
      })}
    </>
  );
};

export const Achievements = ({ achievements }: YearInReviewProps) => {
  // Badges unlock in order, so the latest are the biggest milestones.
  const shown = achievements.slice(-SHOWN).reverse();
  const more = achievements.length - shown.length;
  const headline = `${achievements.length} ${
    achievements.length === 1 ? "badge" : "badges"
  }`;

  return (
    <Scene
      id="achievements"
      backdrop={
        <>
          <Confetti />
          {shown.map((badge, i) => (
            <Card
              key={badge.name}
              icon={badge.icon}
              name={badge.name}
              index={i}
              count={shown.length}
            />
          ))}
        </>
      }
    >
      <Sound name="confetti" at={CONFETTI_AT} volume={0.4} />
      {/* A ting as each card swings out. */}
      {shown.map((badge, i) => (
        <Sound
          key={badge.name}
          name="medal"
          at={FAN_FROM + Math.abs(i - (shown.length - 1) / 2) * FAN_STAGGER + 0.3}
          volume={0.18}
        />
      ))}
      <Rise delay={0}>
        <div style={lead}>Ka pai! This year you unlocked</div>
      </Rise>
      <Rise delay={0.2} distance={80} style={{ marginTop: 12 }}>
        <div
          style={{
            ...display(fitFontSize(headline, 230, undefined, 0.46)),
            color: colors.forest500,
          }}
        >
          <CountUp value={achievements.length} delay={0.2} duration={0.7} />{" "}
          <span style={italic}>
            {achievements.length === 1 ? "badge" : "badges"}
          </span>
        </div>
      </Rise>
      {more > 0 && (
        <Rise delay={2.2} style={{ marginTop: "auto" }}>
          <div style={{ ...body, fontWeight: 600 }}>
            Plus {more} more on your profile.
          </div>
        </Rise>
      )}
    </Scene>
  );
};
