"use client";

import { useCallback, useEffect, useRef } from "react";
import { Player, type PlayerRef, type RenderPoster } from "@remotion/player";
import { YearInReview } from "@/remotion/year-in-review/YearInReview";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";
import { FPS, getDurationInFrames } from "@/remotion/year-in-review/timeline";
import { colors, layout } from "@/remotion/year-in-review/theme";

/**
 * The intro opens on an empty frame, so the player waits on the intro once
 * it has settled (name and year on the plate) and jumps back to the start
 * on first play.
 */
const POSTER_FRAME = Math.round(2.5 * FPS);

/** A play button over the waiting frame; clicks pass through to the player. */
const POSTER_BUTTON = 72;

/** The waiting frame dimmed under a play button in the middle. */
const renderPoster: RenderPoster = function Poster() {
  const size = POSTER_BUTTON;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundColor: "rgba(14, 42, 28, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: colors.sun,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.3)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.42}
          height={size * 0.42}
          aria-hidden
          style={{ marginLeft: size * 0.06 }}
        >
          <path d="M6 4.5v15l13-7.5z" fill={colors.forest700} />
        </svg>
      </div>
    </div>
  );
};

/**
 * The "Year in mahi" video, played live from the same composition the
 * download renders. Loaded with `next/dynamic` (no SSR) by
 * {@link YearInReviewPlayerFrame}, so Remotion stays out of the server bundle.
 */
export default function YearInReviewPlayer({
  data,
}: {
  readonly data: YearInReviewProps;
}) {
  const playerRef = useRef<PlayerRef>(null);
  const started = useRef(false);

  const onPlay = useCallback(() => {
    if (started.current) return;
    started.current = true;
    playerRef.current?.seekTo(0);
  }, []);

  // Back to the waiting frame at the end, ready to play from the top again.
  const onEnded = useCallback(() => {
    started.current = false;
    playerRef.current?.seekTo(POSTER_FRAME);
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    player?.addEventListener("play", onPlay);
    player?.addEventListener("ended", onEnded);
    return () => {
      player?.removeEventListener("play", onPlay);
      player?.removeEventListener("ended", onEnded);
    };
  }, [onPlay, onEnded]);

  return (
    <Player
      ref={playerRef}
      component={YearInReview}
      inputProps={data}
      durationInFrames={getDurationInFrames(data)}
      fps={FPS}
      compositionWidth={layout.width}
      compositionHeight={layout.height}
      initialFrame={POSTER_FRAME}
      renderPoster={renderPoster}
      showPosterWhenUnplayed
      controls
      clickToPlay
      doubleClickToFullscreen
      allowFullscreen
      spaceKeyToPlayOrPause
      // On phones the player plays audio through a pool of <audio> tags
      // unlocked on the first tap; the badges scene can stack the music,
      // confetti, five medal tings and a whip at once.
      numberOfSharedAudioTags={16}
      acknowledgeRemotionLicense
      style={{ width: "100%", height: "100%" }}
    />
  );
}
