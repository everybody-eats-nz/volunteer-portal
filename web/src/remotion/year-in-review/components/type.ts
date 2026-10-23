import type { CSSProperties } from "react";
import { fonts } from "../theme";

/** The short line that sets up each scene's hero number or phrase. */
export const lead: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 700,
  fontSize: 54,
  lineHeight: 1.2,
  textWrap: "balance",
};

/** Supporting sentences under the hero. */
export const body: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 500,
  fontSize: 46,
  lineHeight: 1.35,
  maxWidth: 860,
  textWrap: "balance",
};

/** Fraunces display type; pass a size per use. */
export const display = (fontSize: number): CSSProperties => ({
  fontFamily: fonts.display,
  fontWeight: 800,
  fontSize,
  lineHeight: 0.92,
  letterSpacing: "-0.03em",
  textWrap: "balance",
});
