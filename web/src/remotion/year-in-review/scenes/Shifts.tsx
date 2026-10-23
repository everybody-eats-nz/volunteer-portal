import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, Rise, Scene, Words } from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, formatNumber, layout } from "../theme";

const firstShiftDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  timeZone: "Pacific/Auckland",
});

const TALLY_WIDTH = layout.width - layout.gutter * 2;
const TALLY_HEIGHT = 250;
/** When the first plate lands, and how long the whole stack takes. */
const TALLY_START = 0.35;
const TALLY_SECONDS = 1.6;

/** The largest plate size that fits `count` plates in the tally box. */
const plateSize = (count: number) => {
  for (let size = 120; size > 6; size -= 2) {
    const columns = Math.floor(TALLY_WIDTH / size);
    if (Math.ceil(count / columns) * size <= TALLY_HEIGHT) return size;
  }
  return 6;
};

/** Seconds into the scene that plate `i` of `count` lands. */
const landsAt = (i: number, count: number) =>
  TALLY_START + (count > 1 ? (i / (count - 1)) * TALLY_SECONDS : 0);

/** A plate seen from above: a rim around the well. */
const Plate = ({
  index,
  count,
  size,
}: {
  readonly index: number;
  readonly count: number;
  readonly size: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = spring({
    frame,
    fps,
    delay: landsAt(index, count) * fps,
    config: { damping: 11, stiffness: 180 },
  });
  const diameter = size * 0.84;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: diameter,
          height: diameter,
          borderRadius: "50%",
          backgroundColor: colors.forest700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: interpolate(land, [0, 1], [0, 1]),
          translate: `0px ${interpolate(land, [0, 1], [-size * 0.6, 0])}px`,
        }}
      >
        <div
          style={{
            width: "64%",
            height: "64%",
            borderRadius: "50%",
            border: `${Math.max(1.5, diameter * 0.045)}px solid ${colors.sun}`,
            opacity: 0.55,
          }}
        />
      </div>
    </div>
  );
};

/** Counts up in step with the plates landing. */
const TallyCount = ({ count }: { readonly count: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landed = Array.from({ length: count }).filter(
    (_, i) => frame >= landsAt(i, count) * fps
  ).length;

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatNumber(landed)}
    </span>
  );
};

/** Every shift of the year stacked up as a plate, one after another. */
const Tally = ({ count }: { readonly count: number }) => {
  const size = plateSize(count);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        width: TALLY_WIDTH,
        height: TALLY_HEIGHT,
        alignContent: "flex-start",
        marginLeft: -size * 0.08,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Plate key={i} index={i} count={count} size={size} />
      ))}
    </div>
  );
};

export const Shifts = ({ shifts }: YearInReviewProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { first } = shifts;
  const where = first.location ? ` in ${first.location}` : "";

  return (
    <Scene id="shifts">
      <Rise delay={0}>
        <div style={lead}>You turned up for</div>
      </Rise>
      <div
        style={{
          ...display(shifts.completed >= 100 ? 420 : 500),
          // Lands with a nudge when the last plate does.
          scale: interpolate(
            frame,
            [
              (TALLY_START + TALLY_SECONDS) * fps,
              (TALLY_START + TALLY_SECONDS + 0.12) * fps,
              (TALLY_START + TALLY_SECONDS + 0.35) * fps,
            ],
            [1, 1.06, 1],
            clamp
          ),
          transformOrigin: "left center",
          opacity: interpolate(frame, [0, 0.2 * fps], [0, 1], clamp),
        }}
      >
        <TallyCount count={shifts.completed} />
      </div>
      <Words
        text={[{ italic: shifts.completed === 1 ? "shift" : "shifts" }]}
        delay={0.2}
        style={{ ...display(150), marginTop: -24, marginBottom: 44 }}
      />
      <Tally count={shifts.completed} />
      <Sound name="tally" at={TALLY_START} volume={0.4} />
      <div style={{ flex: 1 }} />
      <Rise delay={2.1}>
        <div style={{ ...body, fontWeight: 600 }}>
          That&apos;s {formatNumber(shifts.hours)} hours of mahi.
        </div>
      </Rise>
      <Rise delay={2.4} style={{ marginTop: 16 }}>
        <div style={body}>
          It all started on {firstShiftDate.format(new Date(first.date))} with a{" "}
          {first.role} shift{where}.
        </div>
      </Rise>
    </Scene>
  );
};
