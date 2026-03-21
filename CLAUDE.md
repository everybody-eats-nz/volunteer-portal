# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Everybody Eats Volunteer Portal — a monorepo for managing volunteers at a charitable restaurant. Three independent projects share a single repository:

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `web/` | Next.js 16, Prisma, PostgreSQL | Admin dashboard, volunteer web portal, API backend |
| `mobile/` | React Native, Expo, expo-router | Mobile companion app for volunteers |
| `docs/` | Astro | Public documentation site |

Each project has its own `package.json`, `node_modules`, and toolchain — there is no shared workspace or Turborepo. Run `npm install` inside the relevant directory.

## UI/UX Design

**IMPORTANT**: When making ANY frontend changes — whether in the web app (`/web/`, React/Next.js components, pages, layouts) or mobile app (`/mobile/`, React Native screens, components) — ALWAYS load both the `ui-ux-pro-max` and `frontend-design` skills first before writing or modifying UI code. This applies to new screens, component edits, styling changes, layout work, and design system updates. No exceptions.

## Essential Commands

### Web App (`web/`)

```bash
cd web
npm install
npm run dev           # Start dev server on http://localhost:3000
npm run build         # Production build
npm run lint          # ESLint
```

### Mobile App (`mobile/`)

```bash
cd mobile
npm install
npx expo start        # Start Expo dev server
npx expo run:ios      # Run on iOS simulator
npx expo run:android  # Run on Android emulator
```

### Database (from `web/`)

```bash
cd web
npm run prisma:generate  # Generate Prisma client after schema changes
npm run prisma:migrate   # Run migrations in development
npm run prisma:seed      # Seed database with initial data
npm run prisma:reset     # Reset database (drops data, runs migrations, seeds)
npm run prisma:deploy    # Deploy migrations to production
```

### Testing (from `web/`)

```bash
# Unit tests (Vitest)
cd web
npm run test         # Watch mode
npm run test:run     # Single run (CI)

# E2E tests (Playwright) — ALWAYS use --project=chromium
cd web
npm run test:e2e                                        # All e2e tests
npx playwright test test.spec.ts --project=chromium     # Single test (RECOMMENDED)
```

## Monorepo Structure

```
/
├── web/                    # Next.js web application (primary)
│   ├── src/
│   │   ├── app/            # App Router pages and API routes
│   │   │   ├── api/        # REST API (consumed by both web and mobile)
│   │   │   ├── admin/      # Admin dashboard
│   │   │   ├── dashboard/  # Volunteer dashboard
│   │   │   ├── shifts/     # Shift browsing
│   │   │   └── ...
│   │   ├── components/     # React components (ui/, forms/)
│   │   ├── lib/            # Utilities, auth, prisma client
│   │   └── types/          # TypeScript types
│   ├── prisma/             # Schema and migrations
│   ├── tests/              # Playwright e2e tests
│   ├── docs/               # Web-specific documentation
│   └── public/             # Static assets
│
├── mobile/                 # React Native/Expo mobile app
│   ├── app/                # expo-router file-based routes
│   │   ├── (tabs)/         # Tab screens (index, shifts, chat, profile)
│   │   ├── (auth)/         # Login screen
│   │   ├── shift/[id].tsx  # Shift detail (modal route)
│   │   └── friend/[id].tsx # Friend detail (modal route)
│   ├── components/         # RN components (themed-text, auth-gate, ui/)
│   ├── constants/theme.ts  # Brand colors, fonts, design tokens
│   ├── hooks/              # Data hooks (use-shifts, use-profile, etc.)
│   ├── lib/                # API client, auth (SecureStore + JWT)
│   └── STYLE_GUIDE.md      # Complete mobile design system
│
├── docs/                   # Astro documentation site
│
├── .github/                # CI/CD workflows
└── CLAUDE.md               # This file
```

## Cross-App Architecture

### API Boundary

The mobile app (`mobile/`) consumes the web app's REST API (`web/src/app/api/`). Key endpoints:

- `/api/auth/[...nextauth]` — NextAuth (web sessions)
- `/api/auth/mobile/login` — Mobile JWT authentication
- `/api/shifts/*` — Shift listing and management
- `/api/profile` — User profile
- `/api/achievements` — Gamification
- `/api/group-bookings/*` — Group booking system
- `/api/admin/*` — Admin operations (protected)

### Authentication

**Web**: NextAuth with multiple OAuth providers (Google, Facebook, Apple, Credentials). Use `getServerSession(authOptions)` in server components/API routes.

**Mobile**: JWT-based auth stored in `expo-secure-store`. The `AuthGate` component in `mobile/components/auth-gate.tsx` renders `LoginScreen` directly when unauthenticated (no navigation redirects — avoids infinite loops). Auth state managed via `mobile/lib/auth.ts`.

### Shared Design Language

Both apps use the same brand fonts and colors:
- **Fonts**: Libre Franklin (body) + Fraunces (headings)
- **Colors**: Same brand palette defined in `mobile/constants/theme.ts` (mobile) and Tailwind config (web)
- **Te Reo Māori**: Weave in throughout — "Kia ora", "mahi", "whānau", "Ka pai", "Ngā mihi"

## Web App (`web/`) Details

### Tech Stack

- **Next.js 16** with App Router
- **TypeScript** with strict configuration
- **Prisma ORM** with PostgreSQL
- **NextAuth.js** for authentication
- **Tailwind CSS v4** + **shadcn/ui** components
- **motion.dev** for animations
- **Vitest** for unit testing, **Playwright** for e2e

### Key API Patterns

Protected routes check session role:

```typescript
const session = await getServerSession(authOptions);
if (session?.user?.role !== "ADMIN") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

Always use Prisma through the singleton:

```typescript
import { prisma } from "@/lib/prisma";
```

### Database Schema Key Models

- **User**: Volunteer profiles with emergency contacts, role (VOLUNTEER/ADMIN)
- **Shift/ShiftType**: Shift scheduling system
- **Signup**: Shift registrations with status tracking
- **Achievement**: Gamification system with multiple criteria types

### Achievement System

Automatic unlocking based on shift counts (MILESTONE), consecutive months (DEDICATION), hours (IMPACT), and shift types (SPECIALIZATION). Processing in `/api/achievements/route.ts`.

### Group Booking System

Volunteers can create group bookings, send invitations, manage assignments, and handle approval workflows.

### Animation System

Uses **motion.dev** — not CSS animations. All variants in `src/lib/motion.ts`. Motion wrapper components: `MotionButton`, `MotionCard`, `MotionDialog`, `MotionStatCard`. Dashboard wrappers in `src/components/dashboard-animated.tsx`. Animations auto-disabled during e2e tests via `.e2e-testing` class.

### SEO

- Sitemap: `src/app/sitemap.ts`, Robots: `src/app/robots.ts`, Metadata: `src/lib/seo.ts`
- Public pages (indexable): `/`, `/login`, `/register`, `/shifts`
- Private pages (noindex): `/dashboard`, `/profile`, `/admin/*`, `/api/*`
- Use `buildPageMetadata()` from `@/lib/seo` for new public pages

## Mobile App (`mobile/`) Details

### Tech Stack

- **React Native** with **Expo** (new architecture enabled)
- **expo-router** for file-based navigation
- **expo-secure-store** for JWT storage
- **TypeScript** with typed routes

### Design System

See `mobile/STYLE_GUIDE.md` for the complete reference. Key principles:

- **Typography**: Use `ThemedText` component — `title` (Fraunces 28pt), `heading` (22pt), `subtitle` (Libre Franklin 18pt semi-bold), `default` (16pt)
- **Colors**: Import `Brand`, `Colors`, `FontFamily` from `@/constants/theme`
- **Emojis**: Use freely for warmth (📍🕐🍽️🏆🔥📢) — they replace icon-only indicators
- **Native feel**: `useSafeAreaInsets()`, haptic feedback, filled/outline icon toggle for active tab
- **Touch targets**: Minimum 44pt, use `hitSlop` when visual element is smaller
- **Fonts**: Always use `fontFamily: FontFamily.*` — never `fontWeight` alone (custom fonts need explicit family names on both platforms)

### Navigation

File-based routing via expo-router (paths relative to `mobile/`):
- `app/(tabs)/` — Main tab bar (Home, Shifts, Chat, Profile)
- `app/(auth)/` — Login screen
- `app/shift/[id].tsx` — Shift detail screen
- `app/friend/[id].tsx` — Friend profile screen
- Root layout uses `AuthGate` + `Slot` pattern (not `Stack` with explicit screens)

### Data Fetching

Custom hooks in `mobile/hooks/` call the web API via `mobile/lib/api.ts`:
- `useShifts()` — Shift listings
- `useShiftDetail(id)` — Single shift
- `useProfile()` — Current user
- `useFriends()` — Friends list

## Testing Guidelines

### Unit Tests (Vitest — `web/` only)

- Place test files alongside source: `*.test.ts` / `*.test.tsx`
- `globals: true` — `describe`, `it`, `expect` auto-imported
- Mock Prisma and externals via `src/lib/test-setup.ts`
- Use for: pure functions, data transformations, validation, business logic

### E2E Tests (Playwright — `web/` only)

- Tests in `web/tests/e2e/`
- **ALWAYS** run with `--project=chromium` to avoid cross-browser flakiness
- Use `data-testid` attributes — descriptive, hierarchical: `section-element-type`
- Use for: full user workflows, auth flows, admin operations

## Versioning

Automatic semantic versioning via PR labels:

- `version:major` — Breaking changes
- `version:minor` — New features
- `version:patch` — Bug fixes, refactoring
- `version:skip` — Docs, tests only

**IMPORTANT**: Always add a version label when creating PRs: `gh pr edit <PR> --add-label "version:TYPE"`

## Environment Variables

Required in `web/.env.local`:

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Random secret for NextAuth
- `NEXTAUTH_URL` — Application URL
- OAuth provider credentials (`GOOGLE_CLIENT_ID`, etc.)

Required for mobile (`mobile/`):
- API base URL configured in `mobile/lib/api.ts`

## Development Tips

1. **Type Safety**: Use generated Prisma types for database operations
2. **Server Components**: Prefer Server Components for data fetching (web)
3. **Error Handling**: API routes should return appropriate HTTP status codes
4. **Session Checks**: Always verify session and role for protected operations
5. **Database Queries**: Include necessary relations in Prisma queries to avoid N+1
6. **Animations**: Use motion.dev components in web, not CSS animations
7. **Mobile fonts**: Always use `FontFamily.*` tokens, never raw `fontWeight`

## Detailed Documentation

See `web/docs/` for comprehensive guides:

- **[App Router Guide](web/docs/app-router-guide.md)** — Routing, Server Components, auth
- **[Component Development](web/docs/component-development.md)** — React components, shadcn/ui, Tailwind
- **[UI Components System](web/docs/ui-components-system.md)** — Full UI system guide
- **[Libraries & Utilities](web/docs/libraries-utilities.md)** — Shared utilities, services
- **[Database & Schema](web/docs/database-schema.md)** — Prisma, migrations, queries
- **[Testing Guide](web/docs/testing-guide.md)** — Playwright patterns, test utilities
- **[SEO Guide](web/docs/seo-guide.md)** — Search optimization guidelines
- **[OAuth Setup](web/docs/oauth-setup.md)** — Provider configuration
- **[Versioning](web/docs/versioning.md)** — Release process
