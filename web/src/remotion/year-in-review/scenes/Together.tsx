import { CountUp, Rise, Scene } from "../components/motion";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, fitFontSize, fonts, formatNumber } from "../theme";

const EVENTS_SHOWN = 3;

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
      <div
        style={{ ...display(100), color: colors.sun, minWidth: numberWidth }}
      >
        <CountUp value={value} delay={delay} duration={1} />
      </div>
      <div style={{ ...body, fontWeight: 700 }}>{label}</div>
    </div>
  </Rise>
);

export const Together = ({ year, organisation }: YearInReviewProps) => {
  const { events } = organisation;
  const more = events.length - EVENTS_SHOWN;
  // Line the labels up just past the widest number.
  const numberWidth =
    Math.max(
      ...[
        organisation.serviceNights,
        organisation.volunteers,
        organisation.volunteerHours,
      ].map((n) => formatNumber(n).length)
    ) * 56;

  return (
    <Scene background={colors.forest500} color={colors.cream}>
      <Rise delay={0.1}>
        <div style={{ ...lead, color: colors.forest200 }}>
          Together, Everybody Eats served
        </div>
      </Rise>
      <Rise delay={0.3} distance={140} style={{ marginTop: 16 }}>
        <div
          style={{
            ...display(
              fitFontSize(
                formatNumber(organisation.mealsServed),
                290,
                undefined,
                0.52
              )
            ),
            color: colors.sun,
            marginBottom: 16,
          }}
        >
          <CountUp value={organisation.mealsServed} delay={0.3} duration={1.8} />
        </div>
      </Rise>
      <Rise delay={0.6}>
        <div style={display(110)}>meals in {year}</div>
      </Rise>
      <div
        style={{
          marginTop: 72,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <Stat
          value={organisation.serviceNights}
          label="service nights"
          delay={1.4}
          numberWidth={numberWidth}
        />
        <Stat
          value={organisation.volunteers}
          label="volunteers"
          delay={1.6}
          numberWidth={numberWidth}
        />
        <Stat
          value={organisation.volunteerHours}
          label="hours of mahi"
          delay={1.8}
          numberWidth={numberWidth}
        />
      </div>
      {events.length > 0 && (
        <Rise delay={2.6} style={{ marginTop: 64 }}>
          <div style={{ ...body, fontWeight: 700 }}>
            And we hosted {events.length}{" "}
            {events.length === 1 ? "event" : "events"}
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: fonts.body,
              fontWeight: 500,
              fontSize: 40,
              lineHeight: 1.4,
              color: colors.forest200,
            }}
          >
            {events.slice(0, EVENTS_SHOWN).map((event) => (
              <div key={`${event.date}-${event.location}`}>{event.name}</div>
            ))}
            {more > 0 && <div>and {more} more</div>}
          </div>
        </Rise>
      )}
    </Scene>
  );
};
