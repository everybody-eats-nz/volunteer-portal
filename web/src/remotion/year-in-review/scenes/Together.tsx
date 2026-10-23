import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp,
  CountUp,
  easeOut,
  Rise,
  Scene,
  SlotNumber,
  Words,
} from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts, formatNumber, layout } from "../theme";

const TICKETS_SHOWN = 3;
const TICKET_WIDTH = 262;
/** Seconds into the scene that the first ticket slides onto the rail. */
const TICKETS_FROM = 2.5;

const eventDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  timeZone: "Pacific/Auckland",
});

const Stat = ({
  value,
  label,
  delay,
  numberWidth,
}: {
  readonly value: number;
  readonly label: string;
  readonly delay: number;
  readonly numberWidth: number;
}) => (
  <Rise delay={delay} distance={40}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
      <div style={{ ...display(96), color: colors.sun, minWidth: numberWidth }}>
        <CountUp value={value} delay={delay} duration={1} />
      </div>
      <div style={{ ...body, fontWeight: 500 }}>{label}</div>
    </div>
  </Rise>
);

/**
 * An event's docket on the kitchen ticket rail: it slides along the rail,
 * then swings on its clip until it settles.
 */
const Ticket = ({
  name,
  date,
  location,
  index,
}: {
  readonly name: string;
  readonly date: string;
  readonly location: string;
  readonly index: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = (TICKETS_FROM + 0.15 + index * 0.18) * fps;
  const slide = interpolate(frame, [start, start + 0.55 * fps], [1, 0], {
    ...clamp,
    easing: easeOut,
  });
  // A damped pendulum, kicked by the slide stopping.
  const t = Math.max(0, frame - start - 0.45 * fps) / fps;
  const swing = 9 * Math.exp(-3.2 * t) * Math.sin(t * 11);

  return (
    <div
      style={{
        width: TICKET_WIDTH,
        translate: `${slide * (layout.width + 200)}px 0px`,
        rotate: `${slide > 0 ? -6 * slide : swing}deg`,
        transformOrigin: "50% -12px",
      }}
    >
      {/* The clip that holds it on the rail */}
      <div
        style={{
          width: 54,
          height: 26,
          margin: "-30px auto 0",
          borderRadius: 6,
          backgroundColor: colors.forest200,
          border: `3px solid ${colors.forest700}`,
        }}
      />
      <div
        style={{
          marginTop: -4,
          backgroundColor: colors.paper,
          color: colors.ink,
          padding: "26px 22px 28px",
          fontFamily: fonts.mono,
          fontSize: 26,
          lineHeight: 1.35,
          boxShadow: "0 18px 30px rgba(14, 42, 28, 0.28)",
        }}
      >
        <div style={{ fontWeight: 500, minHeight: 3 * 26 * 1.35 }}>{name}</div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `2px dashed rgba(20, 24, 28, 0.35)`,
            opacity: 0.75,
          }}
        >
          {eventDate.format(new Date(date))}
          <br />
          {location}
        </div>
      </div>
    </div>
  );
};

/** The steel rail the tickets hang from, drawn across the frame. */
const Rail = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        marginLeft: -layout.gutter,
        width: layout.width,
        height: 14,
        borderRadius: 7,
        background: `linear-gradient(${colors.cream}, ${colors.forest200})`,
        opacity: 0.85,
        transformOrigin: "left center",
        // Drawn once the heading above has settled.
        scale: `${interpolate(
          frame,
          [(TICKETS_FROM - 0.15) * fps, (TICKETS_FROM + 0.3) * fps],
          [0, 1],
          { ...clamp, easing: easeOut }
        )} 1`,
      }}
    />
  );
};

export const Together = ({ year, organisation }: YearInReviewProps) => {
  const { events } = organisation;
  const more = events.length - TICKETS_SHOWN;
  // Line the labels up just past the widest number.
  const numberWidth =
    Math.max(
      ...[
        organisation.serviceNights,
        organisation.volunteers,
        organisation.volunteerHours,
      ].map((n) => formatNumber(n).length)
    ) * 54;

  return (
    <Scene id="together">
      <Rise delay={0}>
        <div style={{ ...lead, color: colors.forest200 }}>
          Together, Everybody Eats served
        </div>
      </Rise>
      <div
        style={{
          ...display(
            fitFontSize(
              formatNumber(organisation.mealsServed),
              290,
              undefined,
              0.6
            )
          ),
          color: colors.sun,
          marginTop: 20,
        }}
      >
        <SlotNumber value={organisation.mealsServed} delay={0.1} duration={2} />
      </div>
      <Words
        text={["meals in", { italic: String(year) }]}
        delay={0.3}
        style={display(120)}
      />
      <div
        style={{
          marginTop: 56,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Stat
          value={organisation.serviceNights}
          label="service nights"
          delay={1.1}
          numberWidth={numberWidth}
        />
        <Stat
          value={organisation.volunteers}
          label="volunteers"
          delay={1.3}
          numberWidth={numberWidth}
        />
        <Stat
          value={organisation.volunteerHours}
          label="hours of mahi"
          delay={1.5}
          numberWidth={numberWidth}
        />
      </div>
      {events.length > 0 && (
        <>
          <Rise
            delay={TICKETS_FROM - 0.8}
            distance={30}
            style={{ marginTop: 56 }}
          >
            <div style={{ ...body, fontWeight: 600 }}>
              And we hosted {events.length}{" "}
              {events.length === 1 ? "event" : "events"}
              {more > 0 ? `, including` : ""}
            </div>
          </Rise>
          <div style={{ marginTop: 28 }}>
            <Rail />
            {/* Each docket swishing along the rail. */}
            {events.slice(0, TICKETS_SHOWN).map((event, i) => (
              <Sound
                key={`${event.date}-${event.location}`}
                name="page-turn"
                at={TICKETS_FROM + 0.15 + i * 0.18}
                volume={0.3}
              />
            ))}
            <div style={{ display: "flex", gap: 47, marginTop: -2 }}>
              {events.slice(0, TICKETS_SHOWN).map((event, i) => (
                <Ticket
                  key={`${event.date}-${event.location}`}
                  name={event.name}
                  date={event.date}
                  location={event.location}
                  index={i}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </Scene>
  );
};
