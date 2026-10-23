import type { CSSProperties } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, easeOut, Grow, Rise, Scene } from "../components/motion";
import { PhotoCard } from "../components/photo";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { shiftTypePhoto } from "../shift-photos";
import { colors, fonts, layout } from "../theme";

/** Copies of the name in a marquee row: enough to cover the frame twice. */
const COPIES = 6;
const MARQUEE_SIZE = 210;

/** "Glen Innes", "Glen Innes and Onehunga", "A, B and C". */
const listNames = (names: string[]) =>
  names.length <= 1
    ? names[0] ?? ""
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * The role name running edge to edge as a giant ticker, the way an order
 * gets called down the line.
 */
const Marquee = ({
  text,
  delay,
  style,
}: {
  readonly text: string;
  readonly delay: number;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Sweeps in fast, then settles into a steady crawl.
  const travel =
    interpolate(frame, [delay * fps, (delay + 1.1) * fps], [900, 0], {
      ...clamp,
      easing: easeOut,
    }) +
    (frame / fps) * 70;

  return (
    <div
      style={{
        marginLeft: -layout.gutter,
        width: layout.width,
        overflow: "hidden",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          ...display(MARQUEE_SIZE),
          // The display style balances lines; a ticker must never wrap.
          textWrap: "nowrap",
          display: "inline-block",
          translate: `${-travel - 400}px 0px`,
          opacity: interpolate(
            frame,
            [delay * fps, (delay + 0.3) * fps],
            [0, 1],
            clamp
          ),
          ...style,
        }}
      >
        {Array.from({ length: COPIES }, (_, i) => (
          <span key={i} style={{ paddingRight: 60 }}>
            {text}
            <span
              style={{
                display: "inline-block",
                width: 44,
                height: 44,
                marginLeft: 60,
                borderRadius: "50%",
                backgroundColor: "currentColor",
                verticalAlign: "middle",
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
};

export const Roles = ({ roles, locations }: YearInReviewProps) => {
  const [top] = roles;
  const ranked = roles.slice(0, 4);
  const [home, ...elsewhere] = locations;

  return (
    <Scene id="roles">
      <Rise delay={0}>
        <div style={lead}>Your go-to role</div>
      </Rise>
      <Marquee text={top.name} delay={0.1} style={{ marginTop: 28 }} />
      <PhotoCard
        // The same photo the app shows on this shift type.
        photo={shiftTypePhoto(top.name)}
        delay={0.5}
        // Takes whatever room the scene has, within reason: a volunteer
        // with one role gets a bigger photo instead of an empty gap.
        style={{ flex: 1, minHeight: 300, maxHeight: 620, marginTop: 36 }}
      />
      {ranked.length > 1 && (
        <div
          style={{
            marginTop: 44,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {ranked.map((role, i) => (
            <Rise key={role.name} delay={0.9 + i * 0.12} distance={40}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.body,
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: 40,
                  marginBottom: 10,
                }}
              >
                <span>{role.name}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {role.count}
                </span>
              </div>
              <Grow
                axis="x"
                delay={1 + i * 0.12}
                style={{
                  height: 18,
                  borderRadius: 9,
                  width: `${(role.count / top.count) * 100}%`,
                  backgroundColor:
                    i === 0 ? colors.forest700 : "rgba(14, 42, 28, 0.3)",
                }}
              />
            </Rise>
          ))}
        </div>
      )}
      {home && (
        // Any room the photo leaves goes above this, never less than 48px.
        <Rise delay={2} style={{ marginTop: "auto", paddingTop: 48 }}>
          <div style={{ ...body, fontWeight: 600 }}>
            Home kitchen: {home.name}
          </div>
          {elsewhere.length > 0 && (
            <div style={{ ...body, marginTop: 12 }}>
              You also helped out at {listNames(elsewhere.map((l) => l.name))}.
            </div>
          )}
        </Rise>
      )}
    </Scene>
  );
};
