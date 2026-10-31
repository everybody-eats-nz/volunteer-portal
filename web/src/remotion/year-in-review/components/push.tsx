import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { clamp } from "./motion";

/** Fast off the mark, long settle: a card flicked up, not slid. */
const ease = Easing.bezier(0.2, 0.9, 0.2, 1);

const Push = ({
  children,
  presentationDirection,
  presentationProgress,
}: TransitionPresentationComponentProps<Record<string, never>>) => {
  const progress = interpolate(presentationProgress, [0, 1], [0, 1], {
    ...clamp,
    easing: ease,
  });
  // The old scene is pushed up and out as the new one arrives from below.
  const y = presentationDirection === "exiting" ? -progress : 1 - progress;

  return (
    <AbsoluteFill style={{ translate: `0px ${y * 100}%` }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * The next scene pushes the last one up off the top of the frame, the
 * way a story card flicks on, timed so the cut lands on the beat.
 */
export const push = (): TransitionPresentation<Record<string, never>> => ({
  component: Push,
  props: {},
});
