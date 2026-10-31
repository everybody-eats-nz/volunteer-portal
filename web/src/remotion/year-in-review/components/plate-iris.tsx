import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { colors, layout } from "../theme";
import { clamp } from "./motion";

/** Where the iris opens from, and how big it already is. */
export type IrisOrigin = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
};

type PlateIrisProps = { readonly from?: IrisOrigin };

/** The white rim that runs round the iris, in pixels. */
export const RIM = 16;

const CENTRE: IrisOrigin = {
  x: layout.width / 2,
  y: layout.height / 2,
  radius: 0,
};

/** Fast off the mark and a long, soft settle: a plate set down, not dropped. */
const ease = Easing.bezier(0.4, 0.5, 0.15, 1);

const PlateIris = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps: { from = CENTRE },
}: TransitionPresentationComponentProps<PlateIrisProps>) => {
  const progress = interpolate(presentationProgress, [0, 1], [0, 1], {
    ...clamp,
    easing: ease,
  });

  if (presentationDirection === "exiting") {
    // The old scene sinks back under the plate: smaller and in shadow.
    return (
      <AbsoluteFill
        style={{
          scale: `${1 - 0.1 * progress}`,
          transformOrigin: `${from.x}px ${from.y}px`,
        }}
      >
        {children}
        <AbsoluteFill
          style={{
            backgroundColor: colors.forest700,
            opacity: 0.45 * progress,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Grows until the whole frame is inside the circle, rim included.
  const corners = [
    [0, 0],
    [layout.width, 0],
    [0, layout.height],
    [layout.width, layout.height],
  ];
  const cover =
    Math.max(...corners.map(([x, y]) => Math.hypot(x - from.x, y - from.y))) +
    RIM;
  const radius = from.radius + (cover - from.radius) * progress;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          clipPath: `circle(${radius}px at ${from.x}px ${from.y}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
      {/* The plate's rim, and its shadow on the scene underneath. */}
      <div
        style={{
          position: "absolute",
          left: from.x - radius,
          top: from.y - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          boxShadow: `inset 0 0 0 ${RIM}px ${colors.paper}, 0 ${RIM}px ${
            RIM * 3
          }px rgba(0, 0, 0, 0.35)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * The next scene opens over the last as a plate set down on it: a circle
 * with a white rim grows from `from` (the centre of the frame unless the
 * scene before leaves a plate to grow from) until it fills the frame.
 */
export const plateIris = (
  props: PlateIrisProps = {}
): TransitionPresentation<PlateIrisProps> => ({
  component: PlateIris,
  props,
});
