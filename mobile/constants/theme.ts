import { Platform } from 'react-native';

/**
 * Everybody Eats brand tokens — aligned with the web app's globals.css --ee-* variables.
 * Fonts: Libre Franklin (body) + Fraunces (headings).
 */

export const Brand = {
  /** Primary deep green */
  green: '#0e3a23',
  greenDark: '#1d5337',
  greenHover: '#256628',
  greenLight: '#e8f5e8',
  /** Bright lime-yellow accent */
  accent: '#f8fb69',
  accentSubtle: '#fcfd94',
  /** Warm off-white background */
  warmWhite: '#fffdf7',
  nearBlack: '#101418',
};

const tintColorLight = Brand.green;
const tintColorDark = Brand.greenLight;

export const Colors = {
  light: {
    text: Brand.nearBlack,
    textSecondary: '#64748b',
    background: Brand.warmWhite,
    card: '#ffffff',
    tint: tintColorLight,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorLight,
    border: '#e2e8f0',
    accent: Brand.accent,
    primary: Brand.green,
    primaryLight: Brand.greenLight,
    destructive: '#dc2626',
  },
  dark: {
    text: '#e5f0e8',
    textSecondary: '#94a3b8',
    background: '#0f1114',
    card: '#1a1d21',
    tint: tintColorDark,
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: tintColorDark,
    border: 'rgba(255, 255, 255, 0.1)',
    accent: '#3a3b2a',
    primary: Brand.greenDark,
    primaryLight: '#1a2f1a',
    destructive: '#ef4444',
  },
};

/** Font family names registered via expo-font / useFonts in _layout.tsx */
export const FontFamily = {
  /** Libre Franklin — body text */
  regular: 'LibreFranklin_400Regular',
  medium: 'LibreFranklin_500Medium',
  semiBold: 'LibreFranklin_600SemiBold',
  bold: 'LibreFranklin_700Bold',
  /** Fraunces — headings / display */
  heading: 'Fraunces_600SemiBold',
  headingBold: 'Fraunces_700Bold',
};

/** Kept for any platform-specific fallback */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
});
