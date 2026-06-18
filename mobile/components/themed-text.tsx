import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { FontFamily } from '@/constants/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'display'
    | 'displayLarge'
    | 'accent'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'link'
    | 'heading'
    | 'caption';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        // The `accent` italic is meant to be nested inside a display heading,
        // so it deliberately omits its own colour and only swaps the font —
        // it inherits size, line-height and colour from the parent Text.
        type === 'accent' ? undefined : { color },
        styles[type] ?? styles.default,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Big editorial hero — light Fraunces, marketing "display" look. */
  displayLarge: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  /** Section / screen display heading — light Fraunces. */
  display: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  /** Page title — light editorial display (matches the marketing site). */
  title: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  /** Soft-italic accent word — nest inside a display/title to italicise one
   *  word, e.g. <ThemedText type="display">The <ThemedText type="accent">
   *  mahi</ThemedText>, in numbers</ThemedText>. Inherits size + colour. */
  accent: {
    fontFamily: FontFamily.displayItalic,
  },
  heading: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 24,
  },
});
