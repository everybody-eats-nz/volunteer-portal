import type { CSSProperties } from "react";
import {
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Photo } from "../shift-photos";
import { clamp, easeOut } from "./motion";

/**
 * A photo in a rounded card, the way the marketing site frames its photos.
 * It rises into place at `delay`, then pushes in slowly for the rest of the
 * scene so it never sits dead still.
 */
export const PhotoCard = ({
  photo,
  delay = 0,
  focus = "center",
  style,
}: {
  readonly photo: Photo;
  readonly delay?: number;
  /** `object-position` for the crop, e.g. "center 30%". */
  readonly focus?: string;
  readonly style?: CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const start = delay * fps;
  const rise = interpolate(frame, [start, start + 0.8 * fps], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

  return (
    <div
      style={{
        borderRadius: 32,
        overflow: "hidden",
        opacity: interpolate(rise, [0, 0.4], [0, 1], clamp),
        translate: `0px ${(1 - rise) * 140}px`,
        ...style,
      }}
    >
      <Img
        src={staticFile(`year-in-review/${photo}.jpg`)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: focus,
          scale: `${interpolate(frame, [start, durationInFrames], [1.14, 1], {
            ...clamp,
            easing: easeOut,
          })}`,
        }}
      />
    </div>
  );
};
