import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { withAlpha } from '@/lib/color';

type StatusBarScrimProps = {
  /** Paper colour to fade into. Defaults to the theme page background. */
  color?: string;
};

/** Share of the top inset given to the fade, and its cap in points. */
const FADE_RATIO = 0.3;
const MAX_FADE = 16;

/**
 * Opacity falls away from solid paper on an ease-out curve. A straight
 * two-stop ramp reads as a hard band at the top of the fade; these stops let
 * it dissolve. `at` is the position within the fade, 0 (top) to 1 (bottom).
 */
const FADE_CURVE = [
  { at: 0.25, alpha: 0.9 },
  { at: 0.5, alpha: 0.64 },
  { at: 0.72, alpha: 0.32 },
  { at: 0.9, alpha: 0.1 },
  { at: 1, alpha: 0 },
] as const;

/**
 * Paper-coloured cover for the status bar on screens whose scroll content runs
 * edge to edge. Scrolled content dissolves into the page background before it
 * reaches the clock, wifi and battery glyphs instead of colliding with them.
 *
 * Render it after the screen's scroll view so it paints on top (see "Status
 * bar scrim" in STYLE_GUIDE.md). It sits entirely inside the top safe-area
 * inset, so content at rest is never tinted, and it is the same colour as the
 * page, so it only becomes visible once something scrolls beneath it.
 *
 * (The iOS 26 native scroll edge effect was tried first. Set to `hard` on a
 * tab screen it drew nothing: these screens have no navigation bar for it to
 * sit under. It also does not exist on Android or older iOS.)
 */
export function StatusBarScrim({ color }: StatusBarScrimProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const paper = color ?? background;

  // No status bar to protect (web, or a phone in landscape).
  if (insets.top <= 0) return null;

  const fade = Math.min(MAX_FADE, Math.round(insets.top * FADE_RATIO));
  const solid = (insets.top - fade) / insets.top;

  return (
    <LinearGradient
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      colors={[
        paper,
        paper,
        ...FADE_CURVE.map(({ alpha }) => withAlpha(paper, alpha)),
      ]}
      locations={[
        0,
        solid,
        ...FADE_CURVE.map(({ at }) => solid + (1 - solid) * at),
      ]}
      style={[styles.scrim, { height: insets.top }]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
