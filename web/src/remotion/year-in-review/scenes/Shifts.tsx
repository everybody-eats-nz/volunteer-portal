import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp,
  Rise,
  Scene,
  useSquash,
  Words,
} from "../components/motion";
import { Sound } from "../components/sound";
import { body, display, lead } from "../components/type";
import type { YearInReviewProps } from "../schema";
import { colors, formatNumber, layout } from "../theme";
import { beats } from "../timeline";

const firstShiftDate = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  timeZone: "Pacific/Auckland",
});

const TALLY_WIDTH = layout.width - layout.gutter * 2;
const TALLY_HEIGHT = 300;
/** The first dot lands here, and the last on beat three. */
const TALLY_START = 0.6;
const TALLY_END = beats(3);

/** The largest dot size that fits `count` dots in the tally box. */
const dotSize = (count: number) => {
  for (let size = 132; size > 6; size -= 2) {
    const columns = Math.floor(TALLY_WIDTH / size);
    if (Math.ceil(count / columns) * size <= TALLY_HEIGHT) return size;
  }
  return 6;
};

/** Seconds into the scene that dot `i` of `count` lands. */
const landsAt = (i: number, count: number) =>
  TALLY_START + (count > 1 ? (i / (count - 1)) * (TALLY_END - TALLY_START) : 0);

/** One shift, a dot set down from a little height. */
const Dot = ({
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
    config: { damping: 12, stiffness: 190 },
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
          opacity: interpolate(land, [0, 0.2], [0, 1], clamp),
          scale: `${interpolate(land, [0, 1], [1.5, 1])}`,
        }}
      />
    </div>
  );
};

/** Counts up in step with the dots landing, and squashes on the last. */
const TallyCount = ({ count }: { readonly count: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landed = Array.from({ length: count }).filter(
    (_, i) => frame >= landsAt(i, count) * fps
  ).length;
  const squash = useSquash(TALLY_END, 0.16);

  return (
    <div
      style={{
        ...display(count >= 1000 ? 330 : count >= 100 ? 420 : 500),
        fontVariantNumeric: "tabular-nums",
        opacity: interpolate(
          frame,
          [(TALLY_START - 0.15) * fps, TALLY_START * fps],
          [0, 1],
          clamp
        ),
        scale: `1 ${squash}`,
        transformOrigin: "left bottom",
      }}
    >
      {formatNumber(landed)}
    </div>
  );
};

/** Every shift of the year set down as a dot, one after another. */
const Tally = ({ count }: { readonly count: number }) => {
  const size = dotSize(count);
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
        <Dot key={i} index={i} count={count} size={size} />
      ))}
    </div>
  );
};

export const Shifts = ({ shifts }: YearInReviewProps) => {
  const { first } = shifts;
  const where = first.location ? ` in ${first.location}` : "";

  return (
    <Scene id="shifts">
      <Words text="You turned up for" delay={0.05} stagger={0.05} style={lead} />
      <div style={{ marginTop: 20 }}>
        <TallyCount count={shifts.completed} />
      </div>
      <Words
        text={[{ italic: shifts.completed === 1 ? "shift" : "shifts" }]}
        delay={0.3}
        style={{ ...display(150), marginTop: -20, marginBottom: 36 }}
      />
      <Tally count={shifts.completed} />
      <Sound name="tally" at={TALLY_START} volume={0.4} />
      <div style={{ flex: 1 }} />
      <Rise delay={TALLY_END + 0.3}>
        <div style={{ ...body, fontWeight: 600 }}>
          That&apos;s {formatNumber(shifts.hours)} hours of mahi.
        </div>
      </Rise>
      <Rise delay={TALLY_END + 0.55} style={{ marginTop: 12 }}>
        <div style={body}>
          It all started on {firstShiftDate.format(new Date(first.date))} with a{" "}
          {first.role} shift{where}.
        </div>
      </Rise>
    </Scene>
  );
};
