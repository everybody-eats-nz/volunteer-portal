import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type EyebrowProps = {
  children: string;
  /** Override the text + rule colour (e.g. on a coloured panel). */
  color?: string;
  /** Hide the leading hairline rule. */
  rule?: boolean;
  style?: TextStyle;
};

/**
 * Small uppercase kicker preceded by a short hairline rule — the marketing
 * site's section/screen eyebrow. ~11px, wide tracking. Pair above a display
 * heading.
 */
export function Eyebrow({ children, color, rule = true, style }: EyebrowProps) {
  const tint = useThemeColor({}, 'tint');
  const c = color ?? tint;

  return (
    <View style={styles.row}>
      {rule && <View style={[styles.rule, { backgroundColor: c, opacity: 0.5 }]} />}
      <Text
        accessibilityRole="header"
        style={[styles.text, { color: c }, style]}
        numberOfLines={1}
      >
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rule: {
    width: 32,
    height: 1,
  },
  text: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 2, // ~0.18em at 11px
  },
});
