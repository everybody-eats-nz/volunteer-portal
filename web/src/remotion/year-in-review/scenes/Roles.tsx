import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, easeOut, Grow, Rise, Scene, Words } from "../components/motion";
import { PhotoCard } from "../components/photo";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { shiftTypePhoto } from "../shift-photos";
import { colors, fitFontSize, fonts, layout } from "../theme";

/** Copies of the name in a marquee row: enough to cover the frame twice. */
const COPIES = 6;
const MARQUEE_MAX = 170;
/**
 * The smallest a ticker gets. A name that would need to go smaller to show
 * whole between the gutters is set still instead: a ticker of a long name
 * only ever shows a slice of it.
 */
const MARQUEE_MIN = 140;
const HEADLINE_MAX = 150;
const HEADLINE_MIN = 96;
/** Fraunces' average glyph width, generous so the fit is never short. */
const CHAR_WIDTH = 0.4;
const CONTENT_WIDTH = layout.width - layout.gutter * 2;
const PHOTO = 380;
const RANKED = 3;

/** "Glen Innes", "Glen Innes and Onehunga", "A, B and C". */
const listNames = (names: string[]) =>
  names.length <= 1
    ? names[0] ?? ""
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * The role name running edge to edge as a giant ticker, the way an order
 * gets called down the line. `direction` 1 crawls left, -1 right; the
 * outlined row runs against the filled one.
 */
const Marquee = ({
  text,
  size,
  delay,
  direction,
  outlined = false,
  style,
}: {
  readonly text: string;
  readonly size: number;
  readonly delay: number;
  readonly direction: 1 | -1;
  readonly outlined?: boolean;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Sweeps in fast, then settles into a steady crawl its own way.
  const sweep = interpolate(
    frame,
    [delay * fps, (delay + 1.1) * fps],
    [900, 0],
    { ...clamp, easing: easeOut }
  );
  const drift = (frame / fps) * 70;
  // Both rows start well inside their copies; the left-running row keeps
  // going left, the right-running row keeps going right.
  const x = direction === 1 ? -1200 - sweep - drift : -3600 - sweep + drift;

  return (
    <div
      style={{
        marginLeft: -layout.gutter,
        width: layout.width,
        // Clips the sides only: the line box is shorter than the glyphs,
        // and overflow would cut off descenders.
        clipPath: "inset(-30% 0)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <div
        style={{
          ...display(size),
          // The display style balances lines; a ticker must never wrap.
          textWrap: "nowrap",
          display: "inline-block",
          translate: `${x}px 0px`,
          opacity: interpolate(
            frame,
            [delay * fps, (delay + 0.3) * fps],
            [0, 1],
            clamp
          ),
          ...(outlined && {
            color: "transparent",
            WebkitTextStroke: `2px ${colors.forest700}`,
          }),
        }}
      >
        {Array.from({ length: COPIES }, (_, i) => (
          <span key={i} style={{ paddingRight: 56 }}>
            {text}
            <span
              style={{
                display: "inline-block",
                width: 40,
                height: 40,
                marginLeft: 56,
                borderRadius: "50%",
                backgroundColor: colors.forest700,
                verticalAlign: "middle",
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * The go-to role as two tickers running against each other when the whole
 * name fits between the gutters, otherwise a still headline wrapped to fit
 * ("Kitchen Service & Pack Down").
 */
const RoleName = ({ name }: { readonly name: string }) => {
  const tickerSize = fitFontSize(name, MARQUEE_MAX, CONTENT_WIDTH, CHAR_WIDTH);
  if (tickerSize >= MARQUEE_MIN) {
    return (
      <div style={{ marginTop: 16 }}>
        <Marquee text={name} size={tickerSize} delay={0.1} direction={1} />
        <Marquee
          text={name}
          size={tickerSize}
          delay={0.2}
          direction={-1}
          outlined
          style={{ marginTop: -tickerSize * 0.08 }}
        />
      </div>
    );
  }
  // Sized as if over two lines; longer names wrap to more at the minimum.
  const size = fitFontSize(
    name,
    HEADLINE_MAX,
    CONTENT_WIDTH * 2,
    CHAR_WIDTH,
    HEADLINE_MIN
  );
  return (
    <Words
      text={name}
      delay={0.1}
      style={{ ...display(size), marginTop: 24 }}
    />
  );
};

export const Roles = ({ roles, locations }: YearInReviewProps) => {
  const [top] = roles;
  const ranked = roles.slice(0, RANKED);
  const [home, ...elsewhere] = locations;

  return (
    <Scene id="roles">
      <Rise delay={0}>
        <div style={lead}>Your go-to role</div>
      </Rise>
      <RoleName name={top.name} />
      <Sound name="whip" at={0.1} volume={0.3} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 44,
          marginTop: 40,
        }}
      >
        {/* The same photo the app shows on this shift type. */}
        <PhotoCard
          photo={shiftTypePhoto(top.name)}
          delay={0.5}
          style={{ width: PHOTO, height: PHOTO, flexShrink: 0 }}
        />
        {ranked.length > 1 && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            {ranked.map((role, i) => (
              <Rise key={role.name} delay={0.9 + i * 0.12} distance={30}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    fontFamily: fonts.body,
                    fontWeight: i === 0 ? 700 : 500,
                    fontSize: 34,
                    lineHeight: 1.2,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {role.name}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {role.count}
                  </span>
                </div>
                <Grow
                  axis="x"
                  delay={1 + i * 0.12}
                  style={{
                    height: 16,
                    borderRadius: 8,
                    width: `${(role.count / top.count) * 100}%`,
                    backgroundColor:
                      i === 0 ? colors.forest700 : "rgba(14, 42, 28, 0.3)",
                  }}
                />
              </Rise>
            ))}
          </div>
        )}
      </div>
      {home && (
        // Any room the row leaves goes above this, never less than 40px.
        <Rise delay={1.8} style={{ marginTop: "auto", paddingTop: 40 }}>
          <div style={{ ...body, fontWeight: 600 }}>
            Home kitchen: {home.name}
          </div>
          {elsewhere.length > 0 && (
            <div style={{ ...body, marginTop: 8 }}>
              You also helped out at {listNames(elsewhere.map((l) => l.name))}.
            </div>
          )}
        </Rise>
      )}
    </Scene>
  );
};
