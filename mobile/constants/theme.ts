import { Platform } from 'react-native';

/**
 * Everybody Eats brand tokens — aligned with the marketing site
 * (new.everybodyeats.nz) and the web app's globals.css.
 *
 * Palette: cream paper surfaces, forest green, sun-yellow accent.
 * Fonts: Plus Jakarta Sans (body) + Fraunces (display headings, light weight,
 * with a soft editorial italic for accent words).
 *
 * This file is the SINGLE SOURCE OF TRUTH — screens inherit colour and type
 * from here. Prefer the semantic `Colors[scheme]` tokens or the `Palette`
 * scale over inventing new hex values in screen code.
 */

/** Raw brand scale — mirrors marketing-cms tailwind.config.ts. */
export const Palette = {
  cream50: '#FDF8EF', // page background (paper)
  cream100: '#FAF2E4', // soft panel
  cream200: '#F5E9D2', // deeper paper
  forest100: '#D4E3D6',
  forest200: '#9BBDA0',
  forest300: '#5A8B62',
  forest400: '#2E6438',
  forest500: '#1D5337', // primary action / filled surfaces
  forest600: '#163F2A', // hover / darker action
  forest700: '#0E2A1C', // dark panels + primary text
  forest800: '#091A11', // deepest panel
  sun100: '#FBFCB8',
  sun200: '#F8FB69', // accent workhorse (highlights, CTAs — never a large fill)
  sun300: '#EDF03F',
  ink: '#1A1410', // max-contrast warm near-black (text on sun/cream)
} as const;

/**
 * Named brand tokens. Keys are kept stable from the previous (older green)
 * system so existing screens keep compiling — the *values* now point at the
 * marketing palette.
 */
export const Brand = {
  /** Primary forest — actions, buttons, brand fills */
  green: Palette.forest500,
  /** Dark forest — statement panels, hero backgrounds */
  greenDark: Palette.forest700,
  /** Hover / pressed forest */
  greenHover: Palette.forest600,
  /** Soft forest tint — light backgrounds */
  greenLight: Palette.forest100,
  /** Sun-yellow accent — highlights and CTAs only */
  accent: Palette.sun200,
  accentSubtle: Palette.sun100,
  /** Cream paper — light page background */
  warmWhite: Palette.cream50,
  /** Warm near-black — text on accent / cream surfaces */
  nearBlack: Palette.ink,

  /** Convenience pointers to the raw scales */
  cream: { c50: Palette.cream50, c100: Palette.cream100, c200: Palette.cream200 },
  forest: {
    f100: Palette.forest100,
    f200: Palette.forest200,
    f300: Palette.forest300,
    f400: Palette.forest400,
    f500: Palette.forest500,
    f600: Palette.forest600,
    f700: Palette.forest700,
    f800: Palette.forest800,
  },
  sun: { s100: Palette.sun100, s200: Palette.sun200, s300: Palette.sun300 },
} as const;

const tintColorLight = Palette.forest500;
const tintColorDark = '#86D99B'; // lighter forest so it stays legible on dark

/** Shape shared by both colour schemes (keeps light/dark structurally equal). */
export type ThemeColors = {
  text: string;
  textSecondary: string;
  background: string;
  card: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
  accent: string;
  primary: string;
  primaryLight: string;
  destructive: string;
  surfaceSoft: string;
  surfaceSunk: string;
  panel: string;
  panelText: string;
  panelMuted: string;
  onAccent: string;
  accentGlow: string;
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    text: Palette.forest700, // warm near-black for body + headings
    textSecondary: '#5B6A5E', // muted warm green-grey
    background: Palette.cream50,
    card: '#FFFFFF',
    tint: tintColorLight,
    icon: '#5B6A5E',
    tabIconDefault: Palette.forest200,
    tabIconSelected: tintColorLight,
    border: 'rgba(29, 83, 55, 0.15)', // forest-500/15 hairline
    accent: Palette.sun200,
    primary: Palette.forest500,
    primaryLight: '#EEF4EF', // forest tint background
    destructive: '#C2410C', // warm clay-red

    // Reusable surface tokens (avoid bespoke per-screen hexes)
    surfaceSoft: Palette.cream100, // soft paper panel / card alt
    surfaceSunk: Palette.cream200, // sunken paper (inputs, wells)
    panel: Palette.forest700, // dark forest statement panel
    panelText: Palette.cream50, // text on dark panel
    panelMuted: 'rgba(253, 248, 239, 0.7)', // muted text on dark panel
    onAccent: Palette.ink, // text on sun-yellow
    accentGlow: 'rgba(248, 251, 105, 0.18)', // sun glow on dark panels
  },
  dark: {
    text: '#E5F0E8',
    textSecondary: '#9DB0A4',
    background: '#0F1114',
    card: '#16181D',
    tint: tintColorDark,
    icon: '#9DB0A4',
    tabIconDefault: '#5A6B60',
    tabIconSelected: tintColorDark,
    border: 'rgba(253, 248, 239, 0.14)', // cream/14 hairline
    accent: Palette.sun200,
    primary: Palette.forest500,
    primaryLight: '#16261B', // dark forest tint background
    destructive: '#F87171',

    surfaceSoft: '#1A1F1B', // soft elevated forest-tinted surface
    surfaceSunk: '#11151A',
    panel: Palette.forest700,
    panelText: Palette.cream50,
    panelMuted: 'rgba(253, 248, 239, 0.7)',
    onAccent: Palette.ink,
    accentGlow: 'rgba(248, 251, 105, 0.16)',
  },
};

/**
 * Font family names registered via `useFonts` in `app/_layout.tsx`.
 *
 * Body keys (regular/medium/semiBold/bold) → Plus Jakarta Sans.
 * Display keys → Fraunces. `display` is the marketing light weight; use it for
 * large editorial headings. `displayItalic` is the soft editorial accent — wrap
 * a single word per heading in it (real italic font file, not RN `fontStyle`).
 *
 * Rule: always set `fontFamily: FontFamily.*` — never `fontWeight` alone; custom
 * fonts need explicit family names on both platforms.
 */
export const FontFamily = {
  // Plus Jakarta Sans — body
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  // Fraunces — display / headings
  display: 'Fraunces_300Light', // marketing light editorial display
  displayItalic: 'Fraunces_300Light_Italic', // soft-italic accent word
  displayMedium: 'Fraunces_500Medium', // slightly stronger display
  heading: 'Fraunces_600SemiBold', // section headings
  headingBold: 'Fraunces_700Bold', // heaviest titles / emphasis
} as const;

/** Kept for any platform-specific fallback */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
});
