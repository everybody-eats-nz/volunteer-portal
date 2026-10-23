import type { CSSProperties, ReactNode } from "react";
import { colors } from "../theme";

/**
 * A white plate seen from above: rim, a faint line where the well starts,
 * and a soft shadow on the table. The video's recurring object, after the
 * site's "one plate at a time": the year is served on one, the months ring
 * one, and the brand is served on one at the end. `children` sit in the
 * well.
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
        width: "70%",
        height: "70%",
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
