import {
  Html5Audio,
  interpolate,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";

/**
 * The video's sounds, in `public/year-in-review/audio/`. Whoosh, whip,
 * page turn, mouse click and ding are from Remotion's sound library
 * (remotion.media), copied in so renders don't depend on it; the rest are
 * synthesised by `npm run video:sounds`, so Everybody Eats owns them.
 */
export type SoundName =
  | "whoosh"
  | "whip"
  | "page-turn"
  | "mouse-click"
  | "ding"
  | "plate-down"
  | "tally"
  | "month-run"
  | "bloom"
  | "confetti"
  | "medal"
  | "printer-step"
  | "stamp";

/** Each file's length, and the silence before its hit, in seconds. */
const TIMING: Record<SoundName, { length: number; leadIn: number }> = {
  whoosh: { length: 0.15, leadIn: 0.05 },
  whip: { length: 0.17, leadIn: 0.01 },
  "page-turn": { length: 0.4, leadIn: 0.08 },
  "mouse-click": { length: 0.4, leadIn: 0.12 },
  ding: { length: 1.4, leadIn: 0.15 },
  "plate-down": { length: 0.9, leadIn: 0 },
  tally: { length: 2.2, leadIn: 0 },
  "month-run": { length: 2.4, leadIn: 0 },
  bloom: { length: 2.8, leadIn: 0 },
  confetti: { length: 1.4, leadIn: 0 },
  medal: { length: 0.9, leadIn: 0 },
  "printer-step": { length: 0.09, leadIn: 0 },
  stamp: { length: 0.5, leadIn: 0 },
};

/**
 * Lifts every effect together; per-cue volumes are relative. Measured on a
 * full render: the mix peaks around -3 dBFS and sits near typical social
 * video loudness without clipping.
 */
const MIX = 1.8;

/**
 * A sound effect whose hit lands `at` seconds into the current sequence.
 * It's mounted only while it plays, which keeps the player's shared audio
 * tags free on phones.
 */
export const Sound = ({
  name,
  at,
  volume = 0.5,
}: {
  readonly name: SoundName;
  readonly at: number;
  readonly volume?: number;
}) => {
  const { fps } = useVideoConfig();
  const { length, leadIn } = TIMING[name];

  return (
    <Sequence
      name={`Sound: ${name}`}
      from={Math.round(at * fps)}
      durationInFrames={Math.ceil((length - leadIn) * fps) + 1}
      layout="none"
    >
      <Html5Audio
        src={staticFile(`year-in-review/audio/${name}.mp3`)}
        trimBefore={Math.round(leadIn * fps)}
        volume={Math.min(1, volume * MIX)}
      />
    </Sequence>
  );
};

/** How loud the music sits under the effects. */
const MUSIC_VOLUME = 0.26;

/**
 * The music bed (`music.mp3`, 62 seconds, longer than any video) under the
 * whole video, faded in at the start and out at the end.
 */
export const Music = ({
  durationInFrames,
}: {
  readonly durationInFrames: number;
}) => {
  const { fps } = useVideoConfig();

  return (
    <Html5Audio
      src={staticFile("year-in-review/audio/music.mp3")}
      volume={(frame) =>
        interpolate(
          frame,
          [0, fps, durationInFrames - 1.5 * fps, durationInFrames],
          [0, MUSIC_VOLUME, MUSIC_VOLUME, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      }
    />
  );
};
