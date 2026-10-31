import type { CSSProperties, ReactNode } from "react";
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Photo } from "../shift-photos";
import { colors } from "../theme";
import { clamp, easeOut } from "./motion";
import { Sound } from "./sound";

/**
 * A white plate seen from above: rim, a faint line where the well starts,
 * and a soft shadow on the table. The video's one recurring object, after
 * the site's "one plate at a time": the year is served on one, every scene
 * arrives as one, photos sit on one and the months ring one. `children`
 * sit in the well.
 */
export const Plate = ({
  size,
  children,
  style,
}: {
  readonly size: number;
  readonly children?: ReactNode;
  readonly style?: CSSProperties;
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: colors.paper,
      boxShadow: `0 ${size * 0.05}px ${
        size * 0.1
      }px rgba(0, 0, 0, 0.28), inset 0 -${size * 0.012}px ${
        size * 0.03
      }px rgba(14, 42, 28, 0.08)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    <div
      style={{
        width: "72%",
        height: "72%",
        borderRadius: "50%",
        border: `${Math.max(2, size * 0.004)}px solid rgba(14, 42, 28, 0.08)`,
        boxShadow: `inset 0 ${size * 0.01}px ${
          size * 0.03
        }px rgba(14, 42, 28, 0.07)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: colors.forest700,
      }}
    >
      {children}
    </div>
  </div>
);

/**
 * A photo served on a plate: a round crop inside a white rim. It's set down
 * at `delay` (springs up a touch large and settles, with the plate's clink),
 * then pushes in slowly for the rest of the scene so it never sits still.
 */
export const PhotoPlate = ({
  photo,
  size,
  delay = 0,
  focus = "center",
  sound = true,
  style,
}: {
  readonly photo: Photo;
  readonly size: number;
  readonly delay?: number;
  /** `object-position` for the crop, e.g. "center 30%". */
  readonly focus?: string;
  readonly sound?: boolean;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const start = delay * fps;
  const land = spring({
    frame,
    fps,
    delay: start,
    config: { damping: 14, stiffness: 120 },
  });
  const rim = Math.round(size * 0.04);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: colors.paper,
        padding: rim,
        boxSizing: "border-box",
        boxShadow: `0 ${size * 0.05}px ${size * 0.1}px rgba(0, 0, 0, 0.3)`,
        opacity: interpolate(land, [0, 0.25], [0, 1], clamp),
        scale: `${interpolate(land, [0, 1], [1.18, 1])}`,
        rotate: `${interpolate(land, [0, 1], [-10, 0])}deg`,
        overflow: "hidden",
        ...style,
      }}
    >
      {sound && <Sound name="plate-down" at={delay + 0.18} volume={0.3} />}
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
        <Img
          src={staticFile(`year-in-review/${photo}.jpg`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: focus,
            scale: `${interpolate(frame, [start, durationInFrames], [1.16, 1], {
              ...clamp,
              easing: easeOut,
            })}`,
          }}
        />
      </div>
    </div>
  );
};
