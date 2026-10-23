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

const SHOWN = 6;
const MEDAL = 246;
const SCALLOPS = 18;
/** Seconds into the scene that the first medal flips over. */
const MEDALS_FROM = 0.8;
const MEDAL_STAGGER = 0.14;

/** A rosette outline: a circle with a scalloped rim, like a ribbon medal. */
const rosette = (() => {
  const r = MEDAL / 2;
  const inner = r * 0.9;
  const points: string[] = [];
  for (let i = 0; i < SCALLOPS; i++) {
    const a1 = (i / SCALLOPS) * Math.PI * 2;
    const a2 = ((i + 1) / SCALLOPS) * Math.PI * 2;
    const mid = (a1 + a2) / 2;
    const x1 = r + inner * Math.cos(a1);
    const y1 = r + inner * Math.sin(a1);
    const cx = r + r * 1.08 * Math.cos(mid);
    const cy = r + r * 1.08 * Math.sin(mid);
    const x2 = r + inner * Math.cos(a2);
    const y2 = r + inner * Math.sin(a2);
    points.push(`${i === 0 ? `M${x1},${y1}` : ""} Q${cx},${cy} ${x2},${y2}`);
  }
  return `${points.join(" ")} Z`;
})();

/** A badge medal that flips over like a coin as it lands. */
const Medal = ({
  icon,
  name,
  index,
}: {
  readonly icon: string;
  readonly name: string;
  readonly index: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flip = spring({
    frame,
    fps,
    delay: (MEDALS_FROM + index * MEDAL_STAGGER) * fps,
    config: { damping: 13, stiffness: 90 },
  });
  const angle = interpolate(flip, [0, 1], [540, 0]);
  // Past 90 degrees the medal shows its plain back.
  const showingFront = Math.cos((angle * Math.PI) / 180) > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: interpolate(flip, [0, 0.15], [0, 1], clamp),
      }}
    >
      <div
        style={{
          width: MEDAL,
          height: MEDAL,
          position: "relative",
          transform: `perspective(900px) rotateY(${angle}deg) scale(${interpolate(
            flip,
            [0, 1],
            [0.5, 1]
          )})`,
        }}
      >
        <svg
          width={MEDAL}
          height={MEDAL}
          viewBox={`0 0 ${MEDAL} ${MEDAL}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <path
            d={rosette}
            fill={showingFront ? colors.paper : colors.sun}
            stroke={colors.forest500}
            strokeWidth={5}
          />
          <circle
            cx={MEDAL / 2}
            cy={MEDAL / 2}
            r={MEDAL * 0.36}
            fill="none"
            stroke={colors.forest500}
            strokeWidth={2.5}
            strokeDasharray="2 9"
            strokeLinecap="round"
            opacity={0.5}
          />
        </svg>
        {showingFront && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 106,
              lineHeight: 1,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: fonts.body,
          fontWeight: 600,
          fontSize: 30,
          lineHeight: 1.15,
          textAlign: "center",
          marginTop: 18,
          textWrap: "balance",
        }}
      >
        {name}
      </div>
    </div>
  );
};

const CONFETTI = 90;
const CONFETTI_AT = 0.35;
const CONFETTI_COLORS = [
  colors.forest500,
  colors.sun,
  colors.forest700,
  colors.forest200,
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
    <Scene id="achievements" backdrop={<Confetti />}>
      <Sound name="confetti" at={CONFETTI_AT} volume={0.4} />
      {/* A ting as each medal settles face up. */}
      {shown.map((badge, i) => (
        <Sound
          key={badge.name}
          name="medal"
          at={MEDALS_FROM + i * MEDAL_STAGGER + 0.35}
          volume={0.18}
        />
      ))}
      <Rise delay={0}>
        <div style={lead}>Ka pai! This year you unlocked</div>
      </Rise>
      <Rise delay={0.25} distance={120} style={{ marginTop: 16 }}>
        <div
          style={{
            ...display(fitFontSize(headline, 230, undefined, 0.46)),
            color: colors.forest500,
          }}
        >
          <CountUp value={achievements.length} delay={0.25} duration={0.8} />{" "}
          <span style={italic}>
            {achievements.length === 1 ? "badge" : "badges"}
          </span>
        </div>
      </Rise>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            rowGap: 56,
            columnGap: 28,
          }}
        >
          {shown.map((badge, i) => (
            <Medal
              key={badge.name}
              icon={badge.icon}
              name={badge.name}
              index={i}
            />
          ))}
        </div>
        {more > 0 && (
          <Rise delay={2} style={{ marginTop: 48 }}>
            <div style={{ ...body, fontWeight: 600 }}>
              Plus {more} more on your profile.
            </div>
          </Rise>
        )}
      </div>
    </Scene>
  );
};
