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
 * A soft tinted surface plus the foreground that reads on it (≥4.5:1 in both
 * schemes). Used for icon tiles, small pills and status badges.
 */
export type Tone = { bg: string; fg: string };

export type ToneName =
  | 'forest'
  | 'sun'
  | 'amber'
  | 'orange'
  | 'red'
  | 'pink'
  | 'violet'
  | 'blue'
  | 'sky'
  | 'teal'
  | 'emerald'
  | 'slate';

/**
 * Hue tones for the feed's icon tiles, category pills and notification icons.
 * Light is a pastel fill with an 800-weight foreground; dark is the same hue
 * at low opacity (so it sits on `card` and `background` alike) with a
 * 300-weight foreground. Pick a tone by meaning, not by look.
 */
export const Tones: Record<'light' | 'dark', Record<ToneName, Tone>> = {
  light: {
    forest: { bg: '#E3EEE5', fg: Palette.forest500 },
    sun: { bg: '#FEF9C3', fg: '#854D0E' },
    amber: { bg: '#FEF3C7', fg: '#92400E' },
    orange: { bg: '#FFEDD5', fg: '#9A3412' },
    red: { bg: '#FEE2E2', fg: '#991B1B' },
    pink: { bg: '#FCE7F3', fg: '#9D174D' },
    violet: { bg: '#EDE9FE', fg: '#6D28D9' },
    blue: { bg: '#DBEAFE', fg: '#1E40AF' },
    sky: { bg: '#E0F2FE', fg: '#075985' },
    teal: { bg: '#CCFBF1', fg: '#115E59' },
    emerald: { bg: '#D1FAE5', fg: '#065F46' },
    slate: { bg: '#E2E8F0', fg: '#334155' },
  },
  dark: {
    forest: { bg: 'rgba(134, 217, 155, 0.14)', fg: tintColorDark },
    sun: { bg: 'rgba(234, 179, 8, 0.18)', fg: '#FDE047' },
    amber: { bg: 'rgba(245, 158, 11, 0.18)', fg: '#FBBF24' },
    orange: { bg: 'rgba(249, 115, 22, 0.18)', fg: '#FDBA74' },
    red: { bg: 'rgba(239, 68, 68, 0.18)', fg: '#FCA5A5' },
    pink: { bg: 'rgba(236, 72, 153, 0.18)', fg: '#F9A8D4' },
    violet: { bg: 'rgba(139, 92, 246, 0.22)', fg: '#C4B5FD' },
    blue: { bg: 'rgba(59, 130, 246, 0.2)', fg: '#93C5FD' },
    sky: { bg: 'rgba(14, 165, 233, 0.18)', fg: '#7DD3FC' },
    teal: { bg: 'rgba(20, 184, 166, 0.18)', fg: '#5EEAD4' },
    emerald: { bg: 'rgba(16, 185, 129, 0.18)', fg: '#6EE7B7' },
    slate: { bg: 'rgba(148, 163, 184, 0.18)', fg: '#CBD5E1' },
  },
};

export type StatusName = 'confirmed' | 'pending' | 'waitlisted' | 'completed' | 'destructive';

/**
 * A signup / shift status. `bg` + `fg` are the soft badge on a page or card;
 * `solid` + `onSolid` are the filled pill used on dark statement panels
 * (the home hero), where a pastel would wash out.
 */
export type StatusTone = Tone & { solid: string; onSolid: string };

/**
 * The one place a status gets its colour. Confirmed is forest, pending is
 * amber, waitlisted is slate, completed is neutral paper and destructive
 * (full, cancelled, declined) is red. Never colour-only: pair with an icon
 * or a word.
 */
export const StatusColors: Record<'light' | 'dark', Record<StatusName, StatusTone>> = {
  light: {
    confirmed: { ...Tones.light.forest, solid: Palette.sun200, onSolid: Palette.ink },
    pending: { ...Tones.light.amber, solid: '#FBBF24', onSolid: '#3A2808' },
    waitlisted: { ...Tones.light.slate, solid: '#E2E8F0', onSolid: '#0F172A' },
    completed: { bg: Palette.cream200, fg: '#57534E', solid: Palette.cream200, onSolid: '#57534E' },
    destructive: { ...Tones.light.red, solid: '#B91C1C', onSolid: '#FFFFFF' },
  },
  dark: {
    confirmed: { ...Tones.dark.forest, solid: Palette.sun200, onSolid: Palette.ink },
    pending: { ...Tones.dark.amber, solid: '#FBBF24', onSolid: '#3A2808' },
    waitlisted: { ...Tones.dark.slate, solid: '#E2E8F0', onSolid: '#0F172A' },
    completed: { bg: 'rgba(253, 248, 239, 0.08)', fg: '#D6D3D1', solid: '#D6D3D1', onSolid: '#1C1917' },
    destructive: { ...Tones.dark.red, solid: '#F87171', onSolid: '#1C1917' },
  },
};

/**
 * Caps how far Dynamic Type may grow text inside fixed-shape elements (pills,
 * badges, chips, counters). Body text and buttons scale freely; these would
 * otherwise burst their container. Pass as `maxFontSizeMultiplier`.
 */
export const MaxFontScale = {
  /** Pills, badges, chips and other compact labels */
  compact: 1.4,
} as const;

/** Card corner radii (see STYLE_GUIDE "Border Radius"). */
export const Radius = {
  panel: 28,
  card: 24,
  chip: 12,
  tile: 14,
  pill: 999,
} as const;

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
