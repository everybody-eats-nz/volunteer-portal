# Everybody Eats Mobile App — Style Guide

Design system for the React Native/Expo companion app. All screens must follow these patterns for visual consistency.

## Fonts

Loaded in `app/_layout.tsx` via `@expo-google-fonts/*`. Import from `@/constants/theme`:

| Token                    | Font               | Weight   | Use for                         |
| ------------------------ | ------------------ | -------- | ------------------------------- |
| `FontFamily.regular`     | Libre Franklin 400 | Regular  | Body text, descriptions, meta   |
| `FontFamily.medium`      | Libre Franklin 500 | Medium   | Labels, subtle emphasis         |
| `FontFamily.semiBold`    | Libre Franklin 600 | SemiBold | Card titles, tab labels, badges |
| `FontFamily.bold`        | Libre Franklin 700 | Bold     | Stat values, bold emphasis      |
| `FontFamily.heading`     | Fraunces 600       | SemiBold | Section headings (22pt)         |
| `FontFamily.headingBold` | Fraunces 700       | Bold     | Page titles (28pt), hero titles |

**Rule**: Always use `fontFamily: FontFamily.*` — never use `fontWeight` alone, as custom fonts require explicit family names on both platforms.

## ThemedText Types

Use the `<ThemedText>` component with these `type` props:

| Type              | Font                    | Size | Example                                 |
| ----------------- | ----------------------- | ---- | --------------------------------------- |
| `title`           | Fraunces Bold           | 28pt | Page names ("Aroha", "Shifts")          |
| `heading`         | Fraunces SemiBold       | 22pt | Section headers ("What's happening 🌿") |
| `subtitle`        | Libre Franklin SemiBold | 18pt | Card section titles                     |
| `default`         | Libre Franklin Regular  | 16pt | Body text                               |
| `defaultSemiBold` | Libre Franklin SemiBold | 16pt | Emphasized body                         |
| `caption`         | Libre Franklin Regular  | 13pt | Small meta text                         |

## Colors

Import `Brand`, `Colors` from `@/constants/theme`. Always use `Colors[colorScheme ?? 'light']` for theme-aware colors.

### Brand Palette

| Token              | Hex       | Use                                            |
| ------------------ | --------- | ---------------------------------------------- |
| `Brand.green`      | `#0e3a23` | Primary — hero cards, buttons, avatar fallback |
| `Brand.greenLight` | `#e8f5e8` | Light tint backgrounds                         |
| `Brand.accent`     | `#f8fb69` | CTA banners, highlights                        |
| `Brand.warmWhite`  | `#fffdf7` | Light mode background                          |
| `Brand.nearBlack`  | `#101418` | Dark text on accent backgrounds                |

### Theme Colors (use `colors.*`)

| Key                    | Light       | Use                            |
| ---------------------- | ----------- | ------------------------------ |
| `colors.text`          | nearBlack   | Primary text                   |
| `colors.textSecondary` | `#64748b`   | Meta, timestamps, descriptions |
| `colors.background`    | warmWhite   | Page background                |
| `colors.card`          | white       | Card/pill backgrounds          |
| `colors.border`        | `#e2e8f0`   | Dividers, card borders         |
| `colors.primary`       | brand green | Active indicators              |
| `colors.primaryLight`  | greenLight  | Tinted backgrounds             |

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

- Hero cards: `20px`
- Standard cards/pills: `16px`
- Badges/pills: `12px`
- Avatars: fully round (`borderRadius: width/2`)
- Feed icons: `14px` (squircle)

### Cards

- Use `colors.border` for card borders (1px)
- Use `colors.card` for card background
- Hero cards use `Brand.green` background with white text

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

| File                         | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `constants/theme.ts`         | Brand, Colors, FontFamily tokens    |
| `components/themed-text.tsx` | Themed text with font families      |
| `components/haptic-tab.tsx`  | Tab bar button with haptic feedback |
| `app/_layout.tsx`            | Font loading, theme provider        |
| `app/(tabs)/_layout.tsx`     | Tab configuration                   |
| `lib/dummy-data.ts`          | All dummy data types and values     |
