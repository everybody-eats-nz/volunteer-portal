# 📱 Everybody Eats - Mobile App

A React Native companion app for Everybody Eats volunteers — browse upcoming shifts, track achievements, connect with fellow volunteers, and get shift recaps on the go.

## ✨ Features

- 🍽️ **Shift Browsing**: View and sign up for upcoming volunteer shifts
- 🏆 **Achievements**: Track milestones, streaks, and badges
- 👥 **Volunteer Community**: Connect with fellow volunteers and view friend profiles
- 📢 **Activity Feed**: Shift recaps, friend activity, and announcements
- 🌿 **Te Reo Māori**: Bilingual interface weaving in te reo naturally
- 🔐 **Secure Auth**: JWT-based authentication with expo-secure-store

## 🛠️ Tech Stack

- ⚛️ **Framework**: React Native with Expo (new architecture enabled)
- 📝 **Language**: TypeScript with typed routes
- 🧭 **Navigation**: expo-router (file-based routing)
- 🔐 **Auth**: JWT stored in expo-secure-store
- 🎨 **Fonts**: Libre Franklin (body) + Fraunces (headings) via @expo-google-fonts
- 📳 **Haptics**: expo-haptics for native feel

## 🚀 Getting Started

### 📋 Prerequisites

- 📦 Node.js 20+
- 📱 iOS Simulator (Xcode) or Android Emulator (Android Studio)
- 🌐 Web app running at `http://localhost:3000` (provides the API)

### 🔧 Installation

1. **📥 Install dependencies:**

```bash
npm install
```

2. **🏃‍♂️ Start the Expo dev server:**

```bash
npx expo start
```

3. **📱 Run on a device or simulator:**

```bash
npx expo run:ios      # iOS simulator
npx expo run:android  # Android emulator
```

## 📁 Project Structure

- 🧭 `/app/` — expo-router file-based routes
  - `(tabs)/` — Main tab bar (Home, Shifts, Chat, Profile)
  - `(auth)/` — Login screen
  - `shift/[id].tsx` — Shift detail (modal)
  - `friend/[id].tsx` — Friend profile (modal)
- 🧩 `/components/` — Reusable React Native components
- 🎨 `/constants/theme.ts` — Brand colors, fonts, design tokens
- 🪝 `/hooks/` — Data hooks (useShifts, useProfile, useFriends, etc.)
- 🛠️ `/lib/` — API client, auth utilities
- 📖 `/STYLE_GUIDE.md` — Complete mobile design system

## 🎨 Design System

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for the complete reference. Key highlights:

- **Typography**: Use `ThemedText` component — `title` (Fraunces 28pt), `heading` (22pt), `subtitle` (18pt), `default` (16pt)
- **Colors**: Import `Brand`, `Colors`, `FontFamily` from `@/constants/theme`
- **Fonts**: Always use `fontFamily: FontFamily.*` — never `fontWeight` alone
- **Emojis**: Use freely for warmth (📍🕐🍽️🏆🔥📢)
- **Touch targets**: Minimum 44pt, use `hitSlop` for smaller visual elements
- **Tab bar**: Native tabs via `NativeTabs` — SF Symbols on iOS, Material icons on Android

## ⚙️ Environment

The mobile app consumes the web app's REST API. Configure the API base URL in `lib/api.ts`.

## 📚 Learn More

- 📖 [Expo Documentation](https://docs.expo.dev/) — Guides and API reference
- 🧭 [Expo Router](https://docs.expo.dev/router/introduction/) — File-based routing
- 🏠 [Root README](../README.md) — Monorepo overview and cross-app architecture
