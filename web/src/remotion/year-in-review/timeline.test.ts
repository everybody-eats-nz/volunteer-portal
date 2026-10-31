import { describe, expect, it } from "vitest";
import type { YearInReviewProps } from "./schema";
import {
  BEAT,
  beats,
  FPS,
  getDurationInFrames,
  getScenes,
  MAX_SECONDS,
  TRANSITION_FRAMES,
} from "./timeline";

const everything: YearInReviewProps = {
  year: 2026,
  firstName: "Aroha",
  photoUrl: null,
  shifts: {
    completed: 12,
    hours: 40,
    nights: 12,
    first: {
      date: "2026-01-15T04:30:00.000Z",
      location: "Wellington",
      role: "Kitchen Prep",
    },
  },
  impact: { mealsServed: 900, foodSavedKg: 450 },
  rhythm: {
    months: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    busiestMonth: 0,
    favouriteWeekday: 4,
    favouriteWeekdayCount: 6,
  },
  roles: [{ name: "Kitchen Prep", count: 12 }],
  locations: [{ name: "Wellington", count: 12 }],
  crew: {
    alongside: 40,
    friends: [{ name: "Mere", nights: 3, photoUrl: null }],
  },
  achievements: [
    { name: "First Steps", icon: "🌟", description: "First shift" },
  ],
  topPercent: 10,
  organisation: {
    mealsServed: 30000,
    serviceNights: 400,
    volunteers: 600,
    volunteerHours: 9000,
    events: [],
  },
};

describe("getScenes", () => {
  it("plays every scene when there's something to say", () => {
    expect(getScenes(everything)).toHaveLength(11);
  });

  it("skips stories with nothing in them", () => {
    const ids = getScenes({
      ...everything,
      impact: { mealsServed: 0, foodSavedKg: 0 },
      crew: { alongside: 0, friends: [] },
      achievements: [],
      topPercent: null,
    }).map((s) => s.id);
    expect(ids).toEqual([
      "intro",
      "shifts",
      "rhythm",
      "roles",
      "together",
      "docket",
      "outro",
    ]);
  });
});

describe("getScenes", () => {
  it("starts every scene on a beat of the music", () => {
    const scenes = getScenes(everything);
    let start = 0;
    for (const scene of scenes) {
      const beat = start / FPS / BEAT;
      // Within a frame of a whole beat.
      expect(Math.abs(beat - Math.round(beat)) * BEAT * FPS).toBeLessThan(0.5);
      start += scene.durationInFrames - TRANSITION_FRAMES;
    }
  });

  it("gives every scene but the last the overlap under the next push", () => {
    const scenes = getScenes(everything);
    // The intro is six beats, plus the frames it plays on under the push.
    expect(scenes[0].durationInFrames).toBe(
      Math.round(beats(6) * FPS) + TRANSITION_FRAMES
    );
    // The outro is six beats and nothing follows it.
    expect(scenes[scenes.length - 1].durationInFrames).toBe(
      Math.round(beats(82) * FPS) - Math.round(beats(76) * FPS)
    );
  });
});

describe("getDurationInFrames", () => {
  it("overlaps each scene with the next during the transition", () => {
    const scenes = getScenes(everything);
    const sum = scenes.reduce((total, s) => total + s.durationInFrames, 0);
    expect(getDurationInFrames(everything)).toBe(
      sum - TRANSITION_FRAMES * (scenes.length - 1)
    );
  });

  it("fits in a single Instagram Story", () => {
    expect(getDurationInFrames(everything)).toBeLessThanOrEqual(
      MAX_SECONDS * FPS
    );
  });
});
