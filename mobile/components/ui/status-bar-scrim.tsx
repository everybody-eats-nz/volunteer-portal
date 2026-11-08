import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { withAlpha } from '@/lib/color';
import { NativeScrollEdgeEffectView } from '@/modules/scroll-edge-effect';

type StatusBarScrimProps = {
  /**
   * Paper colour the fallback fades into. Defaults to the theme page
   * background. The native effect samples the page itself.
   */
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
 * Keeps scrolled content off the clock, wifi and battery glyphs on screens
 * whose scroll view runs edge to edge.
 *
 * On iOS 26 it is the system's own scroll edge effect, the soft progressive
 * blur a navigation bar gets: content blurs and fades as it slides under the
 * status bar, and the page shows through. Elsewhere (Android, older iOS, and
 * store builds without the native module) it is a paper-coloured fade that
 * dissolves content into the page background instead.
 *
 * Render it after the screen's scroll view (see "Status bar scrim" in
 * STYLE_GUIDE.md): the native view finds that scroll view among its siblings,
 * and the fallback must paint on top of it. Either way it covers only the top
 * safe-area inset, so content at rest is untouched, and it only shows once
 * something scrolls beneath it.
 */
export function StatusBarScrim({ color }: StatusBarScrimProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const paper = color ?? background;

  // No status bar to protect (web, or a phone in landscape).
  if (insets.top <= 0) return null;

  if (NativeScrollEdgeEffectView) {
    return (
      <NativeScrollEdgeEffectView
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.scrim, { height: insets.top }]}
      />
    );
  }

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
