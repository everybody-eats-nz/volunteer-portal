/**
 * Makes the Year in mahi video's music bed and the sound effects Remotion's
 * library doesn't have, all synthesised here so Everybody Eats owns them
 * outright: nothing for Instagram's copyright matching to flag when
 * volunteers post their video.
 *
 *   npm run video:sounds
 *
 * Writes MP3s to public/year-in-review/audio/, encoded with the ffmpeg that
 * ships with @remotion/compositor. Deterministic: the same files every run.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "../public/year-in-review/audio");

type Signal = Float32Array;

const silence = (seconds: number): Signal =>
  new Float32Array(Math.round(seconds * SR));

/** A seeded PRNG (mulberry32), so every run makes identical files. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes `source` into `target` at `at` seconds. */
function mix(target: Signal, source: Signal, at: number, gain = 1) {
  const start = Math.round(at * SR);
  for (let i = 0; i < source.length && start + i < target.length; i++) {
    if (start + i >= 0) target[start + i] += source[i] * gain;
  }
}

/** RBJ cookbook biquad; `frequency` may change over time. */
function biquad(
  input: Signal,
  type: "lowpass" | "highpass" | "bandpass",
  frequency: number | ((t: number) => number),
  q = 0.707
): Signal {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % 32 === 0) {
      const f = typeof frequency === "number" ? frequency : frequency(i / SR);
      const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
      const alpha = Math.sin(w) / (2 * q);
      const cos = Math.cos(w);
      const a0 = 1 + alpha;
      if (type === "lowpass") {
        b0 = (1 - cos) / 2 / a0;
        b1 = (1 - cos) / a0;
        b2 = b0;
      } else if (type === "highpass") {
        b0 = (1 + cos) / 2 / a0;
        b1 = -(1 + cos) / a0;
        b2 = b0;
      } else {
        b0 = alpha / a0;
        b1 = 0;
        b2 = -alpha / a0;
      }
      a1 = (-2 * cos) / a0;
      a2 = (1 - alpha) / a0;
    }
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

function noise(seconds: number, seed: number): Signal {
  const next = random(seed);
  const out = silence(seconds);
  for (let i = 0; i < out.length; i++) out[i] = next() * 2 - 1;
  return out;
}

/** Shapes a signal with an attack and an exponential decay. */
function envelope(signal: Signal, attack: number, decay: number): Signal {
  for (let i = 0; i < signal.length; i++) {
    const t = i / SR;
    signal[i] *= t < attack ? t / attack : Math.exp(-(t - attack) / decay);
  }
  return signal;
}

/** A struck tone built from partials: [ratio, amplitude, decay seconds]. */
function struck(
  frequency: number,
  partials: readonly (readonly [number, number, number])[],
  seconds: number
): Signal {
  const out = silence(seconds);
  for (const [ratio, amplitude, decay] of partials) {
    const f = frequency * ratio;
    if (f > SR * 0.45) continue;
    for (let i = 0; i < out.length; i++) {
      const t = i / SR;
      const attack = Math.min(1, t / 0.002);
      out[i] +=
        Math.sin(2 * Math.PI * f * t) *
        amplitude *
        attack *
        Math.exp(-t / decay);
    }
  }
  return out;
}

/** A soft marimba-like note: wooden, warm, quick to fade. */
const marimba = (frequency: number, seconds = 1.4) =>
  struck(
    frequency,
    [
      [1, 1, 0.55],
      [3.9, 0.22, 0.12],
      [9.2, 0.06, 0.04],
    ],
    seconds
  );

/** A ceramic plate's ring: bright, inharmonic partials. */
const ceramic = (frequency: number, seconds = 0.8) =>
  struck(
    frequency,
    [
      [1, 1, 0.22],
      [1.62, 0.6, 0.16],
      [2.37, 0.4, 0.1],
      [3.11, 0.25, 0.07],
    ],
    seconds
  );

/** A small bell, for the coin-like medal flips. */
const ting = (frequency: number, seconds = 0.9) =>
  struck(
    frequency,
    [
      [1, 1, 0.45],
      [2.76, 0.45, 0.2],
      [5.4, 0.2, 0.08],
    ],
    seconds
  );

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

function normalise(signal: Signal, peak: number): Signal {
  let max = 0;
  for (const v of signal) max = Math.max(max, Math.abs(v));
  const gain = max > 0 ? peak / max : 1;
  for (let i = 0; i < signal.length; i++) signal[i] *= gain;
  return signal;
}

/** Fades the last `seconds` out, so nothing ends on a click. */
function tail(signal: Signal, seconds = 0.03): Signal {
  const n = Math.round(seconds * SR);
  for (let i = 0; i < n && i < signal.length; i++) {
    signal[signal.length - 1 - i] *= i / n;
  }
  return signal;
}

// ---------------------------------------------------------------------------
// Sound effects

/** A plate set down on a bench: a soft knock, then the ceramic rings. */
function plateDown(): Signal {
  const out = silence(0.9);
  mix(
    out,
    envelope(biquad(noise(0.08, 1), "lowpass", 400), 0.002, 0.02),
    0,
    0.8
  );
  mix(out, ceramic(1800), 0.004, 0.5);
  mix(out, ceramic(2650), 0.006, 0.25);
  return out;
}

/** Plates stacking up in a quick run, slowing at the end like the tally. */
function tally(): Signal {
  const out = silence(2.2);
  const count = 22;
  const next = random(2);
  for (let i = 0; i < count; i++) {
    // Mirrors the even stagger the plates land at over 1.6s.
    const at = (i / (count - 1)) * 1.6;
    const pitch = 2100 + next() * 900;
    mix(out, ceramic(pitch, 0.4), at, 0.18 + 0.12 * next());
  }
  return out;
}

/** A rising marimba run, one note per month's bar as it grows. */
function monthRun(): Signal {
  const out = silence(2.4);
  // D major pentatonic, climbing.
  const scale = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88];
  scale.forEach((note, i) => {
    mix(out, marimba(midi(note)), i * 0.06, 0.35);
  });
  return out;
}

/** A shimmer of tiny high notes as the crowd blooms out. */
function bloom(): Signal {
  const out = silence(2.8);
  const next = random(3);
  const notes = [86, 88, 90, 93, 95, 98];
  for (let i = 0; i < 34; i++) {
    // Denser at first, thinning out, like the spiral filling in.
    const at = Math.sqrt(i / 33) * 1.8;
    const note = notes[Math.floor(next() * notes.length)];
    mix(out, ting(midi(note), 0.5), at, 0.08 + 0.06 * next());
  }
  return out;
}

/** A party popper: a soft pop, then paper fluttering down. */
function confetti(): Signal {
  const out = silence(1.4);
  mix(
    out,
    envelope(biquad(noise(0.1, 4), "bandpass", 900, 0.9), 0.001, 0.025),
    0,
    1
  );
  mix(
    out,
    envelope(biquad(noise(0.2, 5), "lowpass", 220), 0.002, 0.05),
    0,
    0.6
  );
  const next = random(6);
  for (let i = 0; i < 40; i++) {
    const grain = envelope(
      biquad(noise(0.03, 100 + i), "bandpass", 3000 + next() * 4000, 2),
      0.001,
      0.008
    );
    mix(out, grain, 0.05 + next() * 1.1, 0.25 * (1 - i / 40));
  }
  return out;
}

/** A medal landing: a bright little ting. */
const medal = () => ting(midi(91), 0.9);

/** One feed step of a thermal docket printer: a short motor buzz. */
function printerStep(): Signal {
  const out = silence(0.09);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    // A stepper motor's rough square-ish whine.
    out[i] = Math.sign(Math.sin(2 * Math.PI * 310 * t)) * 0.4;
  }
  const buzzy = biquad(out, "bandpass", 1300, 1.2);
  mix(buzzy, biquad(noise(0.09, 7), "highpass", 4000), 0, 0.15);
  for (let i = 0; i < buzzy.length; i++) {
    const t = i / SR;
    buzzy[i] *= Math.min(1, t / 0.004) * Math.min(1, (0.09 - t) / 0.012);
  }
  return buzzy;
}

/** A rubber stamp coming down on paper over a wooden bench. */
function stamp(): Signal {
  const out = silence(0.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * (90 - 40 * t) * t) * Math.exp(-t / 0.07);
  }
  mix(
    out,
    envelope(biquad(noise(0.06, 8), "lowpass", 1200), 0.001, 0.012),
    0,
    0.7
  );
  mix(
    out,
    struck(
      420,
      [
        [1, 1, 0.05],
        [2.3, 0.4, 0.03],
      ],
      0.2
    ),
    0,
    0.3
  );
  return out;
}

// ---------------------------------------------------------------------------
// Music

const BPM = 92;
const BEAT = 60 / BPM;
const MUSIC_SECONDS = 62;

/**
 * A gentle bed to sit under the sound effects: broken marimba chords over a
 * soft bass, and a shaker that comes in after the first phrase. D major,
 * I-vi-IV-V, one chord per bar.
 */
function music(): Signal {
  const out = silence(MUSIC_SECONDS);
  const chords = [
    { root: 50, notes: [62, 66, 69, 74] }, // D
    { root: 47, notes: [62, 66, 71, 74] }, // Bm
    { root: 43, notes: [62, 67, 71, 74] }, // G
    { root: 45, notes: [61, 64, 69, 73] }, // A
  ];
  // Up and back down the chord, in eighth notes.
  const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
  const bars = Math.ceil(MUSIC_SECONDS / (BEAT * 4));
  const next = random(9);

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length];
    const barStart = bar * BEAT * 4;
    pattern.forEach((step, i) => {
      // A little human unevenness in time and touch.
      const at = barStart + (i * BEAT) / 2 + (next() - 0.5) * 0.012;
      const accent = i % 2 === 0 ? 1 : 0.7;
      mix(out, marimba(midi(chord.notes[step]), 1.2), at, 0.16 * accent);
    });
    // Soft bass on beats one and three.
    for (const beat of [0, 2]) {
      const bass = struck(
        midi(chord.root),
        [
          [1, 1, 0.9],
          [2, 0.25, 0.4],
        ],
        BEAT * 2
      );
      for (let i = 0; i < 400; i++) bass[i] *= i / 400;
      mix(out, bass, barStart + beat * BEAT, 0.22);
    }
    // The shaker joins after the first phrase.
    if (bar >= 4) {
      for (let i = 0; i < 8; i++) {
        const hit = envelope(
          biquad(noise(0.06, 1000 + bar * 8 + i), "highpass", 7000),
          0.004,
          i % 2 === 1 ? 0.02 : 0.012
        );
        mix(out, hit, barStart + (i * BEAT) / 2, i % 2 === 1 ? 0.05 : 0.025);
      }
    }
  }
  // Take the edge off the top end so it sits back in the mix.
  return biquad(out, "lowpass", 5500);
}

// ---------------------------------------------------------------------------

function writeWav(file: string, signal: Signal) {
  const data = Buffer.alloc(signal.length * 2);
  signal.forEach((v, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2)
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

function ffmpegPath() {
  const require = createRequire(import.meta.url);
  const pkg = `@remotion/compositor-${process.platform}-${process.arch}`;
  return path.join(
    path.dirname(require.resolve(`${pkg}/package.json`)),
    "ffmpeg"
  );
}

const sounds: Record<string, () => Signal> = {
  "plate-down": plateDown,
  tally,
  "month-run": monthRun,
  bloom,
  confetti,
  medal,
  "printer-step": printerStep,
  stamp,
  music,
};

const ffmpeg = ffmpegPath();
const scratch = mkdtempSync(path.join(tmpdir(), "yir-sounds-"));
try {
  for (const [name, make] of Object.entries(sounds)) {
    const wav = path.join(scratch, `${name}.wav`);
    writeWav(wav, tail(normalise(make(), 0.89)));
    execFileSync(
      ffmpeg,
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        wav,
        "-c:a",
        "libmp3lame",
        "-b:a",
        name === "music" ? "80k" : "96k",
        path.join(OUT, `${name}.mp3`),
      ],
      { env: { ...process.env, DYLD_LIBRARY_PATH: path.dirname(ffmpeg) } }
    );
    console.log(`${name}.mp3`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
