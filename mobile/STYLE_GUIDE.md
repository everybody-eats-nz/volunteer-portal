# Everybody Eats Mobile App — Style Guide

Design system for the React Native/Expo companion app, aligned with the
Everybody Eats marketing site (new.everybodyeats.nz) and the web volunteer
portal: **cream paper surfaces, forest green, sun-yellow accent**, with
**Fraunces** light editorial display headings over **Plus Jakarta Sans** body.
The canonical brand reference is `marketing-cms/STYLEGUIDE.md`.

`constants/theme.ts` is the **single source of truth** — screens inherit colour
and type from it. Prefer the semantic `Colors[scheme]` tokens or the `Palette`
scale over inventing new hex values in screen code.

## Fonts

Loaded in `app/_layout.tsx` via `@expo-google-fonts/*`. Import from `@/constants/theme`:

| Token                    | Font                       | Use for                              |
| ------------------------ | -------------------------- | ------------------------------------ |
| `FontFamily.regular`     | Plus Jakarta Sans 400      | Body text, descriptions, meta        |
| `FontFamily.medium`      | Plus Jakarta Sans 500      | Labels, subtle emphasis              |
| `FontFamily.semiBold`    | Plus Jakarta Sans 600      | Card titles, tab labels, badges, buttons |
| `FontFamily.bold`        | Plus Jakarta Sans 700      | Small bold labels, stat units        |
| `FontFamily.display`     | Fraunces 300 **Light**     | Large editorial display headings + big numerals (≥~36px) |
| `FontFamily.displayItalic` | Fraunces 300 Light *Italic* | The soft editorial accent word (one per heading) |
| `FontFamily.displayMedium` | Fraunces 500             | Slightly stronger display            |
| `FontFamily.heading`     | Fraunces 600 SemiBold      | Section sub-headings (~22pt)          |
| `FontFamily.headingBold` | Fraunces 700 Bold          | Heaviest emphasis (use sparingly)    |

**The marketing display look is Fraunces _Light_** — reach for `FontFamily.display`
(not `headingBold`) for hero titles and large numbers. Wrap **one word per heading**
in the soft italic for the editorial accent.

**Rule**: Always use `fontFamily: FontFamily.*` — never `fontWeight` alone; custom
fonts require explicit family names on both platforms.

## ThemedText Types

Use the `<ThemedText>` component with these `type` props:

| Type              | Font                     | Size | Example                                  |
| ----------------- | ------------------------ | ---- | ---------------------------------------- |
| `displayLarge`    | Fraunces Light           | 40pt | Hero / celebration headlines             |
| `display`         | Fraunces Light           | 30pt | Big screen / section display headings    |
| `title`           | Fraunces Light           | 28pt | Page names ("Aroha", "Shifts")           |
| `accent`          | Fraunces Light *Italic*  | —    | Nested italic accent word (inherits size + colour) |
| `heading`         | Fraunces SemiBold        | 22pt | Section headers ("What's happening 🌿")  |
| `subtitle`        | Plus Jakarta SemiBold    | 18pt | Card section titles                      |
| `default`         | Plus Jakarta Regular     | 16pt | Body text                                |
| `defaultSemiBold` | Plus Jakarta SemiBold    | 16pt | Emphasized body                          |
| `caption`         | Plus Jakarta Regular     | 13pt | Small meta text                          |

**Editorial accent**: nest `type="accent"` inside a `display`/`title` to italicise
one word — it deliberately omits its own size/colour and inherits from the parent:

```tsx
<ThemedText type="display">
  The <ThemedText type="accent">mahi</ThemedText>, in numbers
</ThemedText>
```

## Colors

Import `Brand`, `Colors`, `Palette` from `@/constants/theme`. Always use
`Colors[colorScheme ?? 'light']` for theme-aware colours.

### Palette scale (raw brand colours)

`Palette.cream50 #FDF8EF` · `cream100 #FAF2E4` · `cream200 #F5E9D2` ·
`forest100 #D4E3D6` · `forest200 #9BBDA0` · `forest300 #5A8B62` ·
`forest400 #2E6438` · `forest500 #1D5337` · `forest600 #163F2A` ·
`forest700 #0E2A1C` · `forest800 #091A11` · `sun100 #FBFCB8` ·
`sun200 #F8FB69` · `sun300 #EDF03F` · `ink #1A1410`.

### Brand tokens

| Token              | Maps to     | Use                                            |
| ------------------ | ----------- | ---------------------------------------------- |
| `Brand.green`      | forest-500  | Primary action — buttons, fills, avatar fallback |
| `Brand.greenDark`  | forest-700  | Dark statement panels / hero backgrounds       |
| `Brand.greenHover` | forest-600  | Hover / pressed                                |
| `Brand.greenLight` | forest-100  | Soft green tint backgrounds                    |
| `Brand.accent`     | sun-200     | Highlights & CTAs **only** — never a large fill |
| `Brand.warmWhite`  | cream-50    | Light page background                          |
| `Brand.nearBlack`  | ink         | Text on sun / cream surfaces                   |

### Theme Colors (use `colors.*`)

| Key                    | Light        | Dark         | Use                            |
| ---------------------- | ------------ | ------------ | ------------------------------ |
| `colors.text`          | forest-700   | `#E5F0E8`    | Primary text + headings        |
| `colors.textSecondary` | `#5B6A5E`    | `#9DB0A4`    | Meta, timestamps, descriptions |
| `colors.background`    | cream-50     | `#0F1114`    | Page background                |
| `colors.card`          | white        | `#16181D`    | Card/pill backgrounds          |
| `colors.border`        | forest-500/15| cream/14     | Dividers, hairlines            |
| `colors.tint`/`primary`| forest-500   | `#86D99B`/forest-500 | Active indicators / actions |
| `colors.primaryLight`  | `#EEF4EF`    | `#16261B`    | Tinted backgrounds             |
| `colors.surfaceSoft`   | cream-100    | `#1A1F1B`    | Soft paper panel / card alt    |
| `colors.surfaceSunk`   | cream-200    | `#11151A`    | Inputs, wells                  |
| `colors.panel`         | forest-700   | forest-700   | Dark forest statement panel    |
| `colors.panelText`     | cream-50     | cream-50     | Text on dark panel             |
| `colors.onAccent`      | ink          | ink          | Text on sun-yellow             |
| `colors.accentGlow`    | sun/0.18     | sun/0.16     | Warm glow on dark panels       |
| `colors.destructive`   | `#C2410C`    | `#F87171`    | Destructive actions            |

## Te Reo Maori

Weave Maori naturally — don't force it. The tone is warm and respectful.

| Maori            | English                 | Where to use                                |
| ---------------- | ----------------------- | ------------------------------------------- |
| Kia ora          | Hello                   | Greeting header                             |
| Mahi             | Work/shifts             | Shift references ("Next mahi")              |
| Whanau           | Family/community        | Community references ("looking for whanau") |
| Ka pai           | Well done               | Achievement celebrations                    |
| Nga mihi (nui)   | Thanks/acknowledgements | Milestone celebrations                      |
| Nau te rourou... | Proverb about community | Footer/about sections                       |

**Note**: Use macrons (a) in display text where possible. The proverb "Nau te rourou, naku te rourou, ka ora ai te iwi" means "With your basket and my basket, the people will thrive."

## Emoji Usage

Emojis add warmth and friendliness. Use them as visual indicators alongside text, not as standalone icons for navigation or actions.

### Standard Emoji Map

| Context            | Emoji  | Example                 |
| ------------------ | ------ | ----------------------- |
| Location           | 📍     | "📍 Wellington"         |
| Time/schedule      | 🕐     | "🕐 4:30 PM"            |
| Countdown (hours)  | ⏰     | "⏰ 6h away"            |
| Countdown (days)   | 📅     | "📅 2 days to go"       |
| Food/shifts        | 🍽️     | "🍽️ Next mahi"          |
| Announcements      | 📢     | Feed icon               |
| New items          | 🆕     | Feed icon               |
| Achievements       | 🏆     | Feed icon               |
| Milestones/streaks | 🔥     | Feed icon               |
| Volunteering/help  | ✋     | CTA banners             |
| Community/aroha    | 🌿🌱💚 | Section headers, footer |
| Greeting           | 👋     | "Kia ora 👋"            |
| Celebration        | 🙌     | Stats, accomplishments  |

### Where NOT to use emojis

- Tab bar icons (use Ionicons with filled/outline toggle)
- Navigation chrome (back buttons, chevrons)
- Form inputs and labels
- Error messages

## Layout Patterns

### Safe Areas

Always use `useSafeAreaInsets()` from `react-native-safe-area-context`:

```tsx
const insets = useSafeAreaInsets();
```

### Spacing

- Page horizontal padding: `20px`
- Section gap: `20-28px`
- Card internal padding: `16-22px`
- Feed item padding: `14px` vertical
- Element gap within cards: `8-12px`

### Border Radius

Round generously — the marketing brand uses soft, paper-like corners.

- Large feature / statement panels: `28–32px`
- Standard cards: `24px`
- Pill buttons & pill badges: `999` (fully rounded)
- Small badges/chips: `12px`
- Avatars: fully round (`borderRadius: width/2`)
- Feed icons: `14px` (squircle)

### Cards

- Soft fill: `colors.card` (white / `#16181D`) or `colors.surfaceSoft` (cream-100)
- `colors.border` for hairlines (1px, forest-500/15 light · cream/14 dark)
- Dark statement panels use `colors.panel` (forest-700) with `colors.panelText`
  (cream-50) and a warm sun glow (see Panels below)

## Brand conventions

### Eyebrow (kicker)

A small uppercase kicker preceded by a 32px hairline rule — sits above a
section/screen display heading. Use the shared component:

```tsx
import { Eyebrow } from '@/components/ui/eyebrow';

<Eyebrow>Our impact so far</Eyebrow>
// On a dark/coloured panel, pass a colour:
<Eyebrow color={Palette.sun200}>New · iOS &amp; Android</Eyebrow>
```

~11px, uppercase, ~0.18em tracking. Pair with a `display`/`title` heading.

### Pill buttons

Fully rounded (`borderRadius: 999`), ≥44pt touch target, subtle press feedback
(opacity + slight scale). Use the shared component:

```tsx
import { Button } from '@/components/ui/button';

<Button label="Browse shifts" onPress={…} icon="arrow-forward" />          // primary forest fill
<Button label="Maybe later" variant="ghost" onPress={…} />                 // hairline outline
<Button label="Get the app" variant="accent" onPress={…} />                // sun-yellow (rare CTA)
<Button label="Sign up" variant="primary" onPanel fullWidth onPress={…} /> // on a dark panel
```

Variants: `primary` (forest fill, cream text), `ghost` (hairline outline,
`onPanel` for dark surfaces), `accent` (sun-200, ink text — use sparingly).
For complex bespoke pressables that carry layout, just round corners to `999`
and retint rather than replacing them.

### Panels & the sun glow

Dark forest panels (`colors.panel`) carry a warm sun glow — a soft radial bloom
in a corner. The pattern is a translucent sun-coloured `<View>` blob behind the
content (clipped by the panel's `overflow: 'hidden'` + rounded corners):

```tsx
<View style={{ position:'absolute', bottom:-120, right:-110, width:280, height:280,
  borderRadius:140, backgroundColor: colors.accentGlow }} />
```

### Sun is accent only

`sun-200` is for highlights, small pills, underlines, and icon accents —
**never** a large background fill or a primary surface.

## Interaction Patterns

### Press Feedback

- Cards/buttons: `opacity: pressed ? 0.85–0.95 : 1`
- Feed items: `opacity: pressed ? 0.7 : 1`
- Like button: `opacity: pressed ? 0.5 : 1`

### Haptic Feedback

Use `expo-haptics` for:

- Tab presses (`ImpactFeedbackStyle.Light`)
- Like/unlike actions (`ImpactFeedbackStyle.Light`)
- Check-in actions (`NotificationFeedbackType.Success`)

### Tab Bar (Native Tabs)

Uses `NativeTabs` from `expo-router/unstable-native-tabs` for truly native tab bars:

- **iOS**: SF Symbols with filled/outline toggle (gets liquid glass on iOS 26 automatically)
- **Android**: Material icons via `md` prop
- Wrapped in `ThemeProvider` with EE brand colours for proper theming
- No custom JS tab bar — fully native rendering

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";

<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
  <NativeTabs.Trigger.Icon
    sf={{ default: "house", selected: "house.fill" }}
    md="home"
  />
</NativeTabs.Trigger>;
```

## Icons

**Tab bar**: Use SF Symbols (iOS) and Material icons (Android) via `NativeTabs.Trigger.Icon`.

**In-screen icons**: Use `@expo/vector-icons/Ionicons`:

- Navigation: `chevron-forward`, `arrow-forward`, `chevron-back`
- Actions: `heart`/`heart-outline` (like), `camera` (photo), `send` (message)
- Info: `location-outline`, `time-outline`, `people-outline`

## File Reference

| File                         | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `constants/theme.ts`         | Palette, Brand, Colors, FontFamily tokens  |
| `components/themed-text.tsx` | Themed text + display/accent type scale    |
| `components/ui/eyebrow.tsx`  | Section/screen eyebrow (kicker + rule)      |
| `components/ui/button.tsx`   | Pill Button (primary / ghost / accent)      |
| `components/haptic-tab.tsx`  | Tab bar button with haptic feedback        |
| `app/_layout.tsx`            | Font loading, theme provider               |
| `app/(tabs)/_layout.tsx`     | Tab configuration                          |
| `lib/dummy-data.ts`          | All dummy data types and values            |
