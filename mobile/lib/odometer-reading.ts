/**
 * Turning what the text recogniser saw into an odometer reading.
 *
 * The camera hands every frame to an on-device recogniser, which returns the
 * text it found and where. Most of that is noise: the trip meter, the clock,
 * a fuel gauge label, the odometer's own "km". This picks the one number that
 * is most likely the dial, or nothing, and it is pure so the rules can be
 * tested without a camera.
 */

export type Box = { x: number; y: number; width: number; height: number };

export type OcrElement = { text: string; boundingBox?: Partial<Box> };
export type OcrLine = { text: string; boundingBox?: Partial<Box>; elements?: OcrElement[] };
export type OcrBlock = { text: string; boundingBox?: Partial<Box>; lines?: OcrLine[] };
export type OcrResult = { text: string; blocks: OcrBlock[] };

export type ReadingHints = {
  /** Where on the photo, in its own pixels, the driver was asked to put the dial. */
  guide?: Box | null;
  /** Nothing at or below this can be the dial. Ending a trip passes its start. */
  minimum?: number | null;
  /** The last reading we recorded, for telling the dial from the trip meter. */
  expected?: number | null;
};

export type OdometerReading = {
  value: number;
  /** The text the number was read from, before any cleaning up. */
  source: string;
};

/**
 * How far a van plausibly travels between two readings. Used only to rank
 * candidates, never to refuse one: the server owns the real plausibility rule.
 */
const PLAUSIBLE_ADVANCE = 3000;

/** Letters the recogniser mistakes digits for on a seven-segment or drum dial. */
const CONFUSABLE: Record<string, string> = {
  O: "0", o: "0", D: "0", Q: "0",
  I: "1", l: "1", i: "1", "|": "1",
  Z: "2", z: "2",
  S: "5", s: "5",
  G: "6",
  B: "8",
  g: "9",
};

/**
 * The digits in a token, or null when it is not a number the dial could show.
 * A trailing unit and a tenths digit after a separator are dropped; letters a
 * dial cannot show are read as the digits they resemble, but only when the
 * token is mostly digits already, so "ODO" and "TRIP" stay words.
 */
export function digitsOf(token: string): string | null {
  const bare = token
    .trim()
    .replace(/^[^0-9A-Za-z|]+/, "")
    .replace(/\s*(km|KM|Km|mi|MI)\.?$/, "")
    .replace(/[.,]\s?[0-9OoDQIliZzSsGBg|]$/, "");
  if (bare.length === 0) return null;

  let genuine = 0;
  let digits = "";
  for (const char of bare) {
    if (char >= "0" && char <= "9") {
      genuine += 1;
      digits += char;
    } else if (CONFUSABLE[char]) {
      digits += CONFUSABLE[char];
    } else {
      return null;
    }
  }
  if (genuine / bare.length < 0.6) return null;
  if (digits.length < 4 || digits.length > 7) return null;
  return digits;
}

type Candidate = OdometerReading & { score: number; height: number };

function boxOf(box: Partial<Box> | undefined): Box | null {
  if (!box || box.width === undefined || box.height === undefined) return null;
  return { x: box.x ?? 0, y: box.y ?? 0, width: box.width, height: box.height };
}

function insideGuide(box: Box | null, guide: Box): boolean | null {
  if (!box) return null;
  const slack = { x: guide.width * 0.25, y: guide.height * 0.35 };
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (
    cx >= guide.x - slack.x &&
    cx <= guide.x + guide.width + slack.x &&
    cy >= guide.y - slack.y &&
    cy <= guide.y + guide.height + slack.y
  );
}

export function readOdometer(
  result: OcrResult | null | undefined,
  hints: ReadingHints = {}
): OdometerReading | null {
  const { guide = null, minimum = null, expected = null } = hints;
  const candidates: Candidate[] = [];

  const consider = (source: string, box: Box | null, bonus: number) => {
    const digits = digitsOf(source);
    if (!digits) return;
    const literal = Number(digits);

    const forms: { value: number; penalty: number }[] = [{ value: literal, penalty: 0 }];
    // A drum odometer's tenths digit reads as one more digit on the end. When
    // the literal number is nowhere near the last reading but the number
    // without its last digit is, that is what happened.
    if (expected !== null && digits.length >= 5) {
      forms.push({ value: Math.floor(literal / 10), penalty: 1 });
    }

    for (const form of forms) {
      const { value } = form;
      if (minimum !== null && value <= minimum) continue;

      let score = bonus - form.penalty;
      const width = String(value).length;
      if (width === 5 || width === 6) score += 2;

      if (guide) {
        const inside = insideGuide(box, guide);
        if (inside === true) score += 4;
      }

      if (expected !== null) {
        const advance = value - expected;
        if (advance >= 0 && advance <= PLAUSIBLE_ADVANCE) score += 3;
        else if (advance < 0 && advance >= -PLAUSIBLE_ADVANCE) score += 1;
        else score -= 2;
      }

      candidates.push({ value, source, score, height: box?.height ?? 0 });
    }
  };

  for (const block of result?.blocks ?? []) {
    for (const line of block.lines ?? []) {
      const lineBox = boxOf(line.boundingBox);
      const elements = line.elements ?? [];
      for (const element of elements) {
        consider(element.text, boxOf(element.boundingBox) ?? lineBox, 0);
      }
      // Drum dials space their digits, and the recogniser may return the
      // groups as separate elements. The line read as one number is offered
      // too, and preferred when every group in it is numeric.
      if (elements.length > 1 && elements.every((element) => digitsOf(element.text) || /^\d{1,3}$/.test(element.text.trim()))) {
        consider(line.text.replace(/\s+/g, ""), lineBox, 1);
      } else if (elements.length === 0) {
        consider(line.text.replace(/\s+/g, ""), lineBox, 0);
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.height - a.height);
  const best = candidates[0];
  return { value: best.value, source: best.source };
}

/**
 * Where a rectangle drawn over the live preview lands on the photo.
 *
 * The preview fills its frame the way `cover` fits an image: scaled until
 * both edges are covered, then centred, so some of the photo is off-screen
 * on the longer axis. Undo that to get the guide in the photo's pixels.
 */
export function guideInImage(
  guide: Box,
  frame: { width: number; height: number },
  image: { width: number; height: number }
): Box | null {
  if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) {
    return null;
  }
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const offsetX = (image.width * scale - frame.width) / 2;
  const offsetY = (image.height * scale - frame.height) / 2;
  return {
    x: (guide.x + offsetX) / scale,
    y: (guide.y + offsetY) / scale,
    width: guide.width / scale,
    height: guide.height / scale,
  };
}

/**
 * The reading the last frames agree on, or null while they still disagree.
 *
 * One frame can misread a digit mid-flicker or catch the drum between two
 * numbers; two in a row saying the same thing is what a barcode scanner
 * waits for too, and it is enough here.
 */
export function settledReading(recent: readonly (number | null)[]): number | null {
  if (recent.length < 2) return null;
  const last = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  return last !== null && last === previous ? last : null;
}
