import type { CSSProperties } from "react";
import { fonts } from "../theme";

// The type scale follows everybodyeats.nz: light Fraunces headlines set
// tight, with italic phrases, and Plus Jakarta Sans for sentences. Sizes
// are for the 1080px-wide frame.

/** The short line that sets up each scene's hero number or phrase. */
export const lead: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 500,
  fontSize: 50,
  lineHeight: 1.25,
  textWrap: "balance",
};

/** Supporting sentences under the hero. */
export const body: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 400,
  fontSize: 44,
  lineHeight: 1.4,
  maxWidth: 860,
  textWrap: "balance",
};

/** Fraunces display type; pass a size per use. */
export const display = (fontSize: number): CSSProperties => ({
  fontFamily: fonts.display,
  fontWeight: 300,
  fontSize,
  lineHeight: 0.94,
  letterSpacing: "-0.035em",
  textWrap: "balance",
});

/** The italic phrase inside a display line, a touch lighter like the site. */
export const italic: CSSProperties = {
  fontStyle: "italic",
  fontWeight: 230,
};
