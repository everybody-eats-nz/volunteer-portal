import { StyleSheet, Text, type TextStyle } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type EyebrowProps = {
  children: string;
  /** Override the text colour (e.g. on a coloured panel). */
  color?: string;
  style?: TextStyle;
};

/**
 * Small uppercase kicker - the marketing site's section/screen eyebrow.
 * ~11px, wide tracking. Pair above a display heading.
 */
export function Eyebrow({ children, color, style }: EyebrowProps) {
  const tint = useThemeColor({}, 'tint');

  return (
    <Text
      accessibilityRole="header"
      style={[styles.text, { color: color ?? tint }, style]}
      numberOfLines={1}
    >
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 2, // ~0.18em at 11px
  },
});
