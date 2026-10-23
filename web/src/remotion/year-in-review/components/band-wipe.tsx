import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { clamp } from "./motion";

type BandWipeProps = { readonly bands: readonly string[] };

/** How far (percent of the height) the wipe's leading edge leans. */
const SLANT = 7;
/** Share of the transition each layer takes to sweep the frame. */
const SWEEP = 0.62;
const ease = Easing.bezier(0.7, 0, 0.25, 1);

/** The clip for a layer `local` of the way through its sweep. */
const sweepClip = (local: number) => {
  // The leading edge rises from below the frame to past the top, lower on
  // the left so it reads as a diagonal sweep.
  const right = 100 - local * (100 + SLANT);
  const left = right + SLANT;
  return `polygon(0% ${left}%, 100% ${right}%, 100% 100%, 0% 100%)`;
};

const BandWipe = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps: { bands },
}: TransitionPresentationComponentProps<BandWipeProps>) => {
  const layers = bands.length + 1;
  const step = (1 - SWEEP) / (layers - 1);
  const local = (i: number) =>
    interpolate(presentationProgress, [i * step, i * step + SWEEP], [0, 1], {
      ...clamp,
      easing: ease,
    });

  if (presentationDirection === "exiting") {
    // Drifts up behind the first band, never faster than the band covers
    // it, so nothing behind the scene shows through.
    const covered = Math.max(0, local(0) * (100 + SLANT) - SLANT);
    return (
      <AbsoluteFill style={{ translate: `0px ${-covered * 0.22}%` }}>
        {children}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      {bands.map((color, i) => (
        <AbsoluteFill
          key={color}
          style={{ backgroundColor: color, clipPath: sweepClip(local(i)) }}
        />
      ))}
      <AbsoluteFill style={{ clipPath: sweepClip(local(bands.length)) }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * The next scene sweeps up on a diagonal behind bands of brand colour, like
 * Wrapped's stacked wipes. `bands` are the colours that lead it in.
 */
export const bandWipe = (
  props: BandWipeProps
): TransitionPresentation<BandWipeProps> => ({
  component: BandWipe,
  props,
});
