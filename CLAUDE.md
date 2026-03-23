# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Everybody Eats Volunteer Portal — a monorepo for managing volunteers at a charitable restaurant (New Zealand-based). Three independent projects share a single repository:

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `web/` | Next.js 16, Prisma 7, PostgreSQL | Admin dashboard, volunteer web portal, API backend |
| `mobile/` | React Native 0.83, Expo 55, expo-router | Mobile companion app for volunteers |
| `docs/` | Astro 5, Starlight | Public documentation site with embedded widget |

Each project has its own `package.json`, `node_modules`, and toolchain — there is no shared workspace or Turborepo. Run `npm install` inside the relevant directory.

**Node.js**: v24 required (see `web/.nvmrc`).

**Timezone**: All operations default to `Pacific/Auckland` (NZ time). Set `TZ=Pacific/Auckland` in environment.

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
npm run typecheck     # TypeScript type checking (tsc --noEmit)
```

### Mobile App (`mobile/`)

```bash
cd mobile
npm install
npx expo start        # Start Expo dev server
npx expo run:ios      # Run on iOS simulator
npx expo run:android  # Run on Android emulator
```

### Docs Site (`docs/`)

```bash
cd docs
npm install
npm run dev           # Start Astro dev server (builds widget first)
npm run build         # Production build (builds widget first)
```

### Database (from `web/`)

```bash
cd web
npm run prisma:generate       # Generate Prisma client after schema changes
npm run prisma:migrate        # Run migrations in development
npm run prisma:seed           # Seed database with initial data
npm run prisma:seed:demo      # Seed with demo data (tsx prisma/seed-demo.ts)
npm run prisma:seed:production # Seed with production essentials only
npm run prisma:reset          # Reset database (drops data, runs migrations, seeds)
npm run prisma:deploy         # Deploy migrations to production
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
npm run test:e2e:ci                                     # CI mode (chromium, list reporter)
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
│   │   │   ├── friends/    # Friends system
│   │   │   ├── achievements/ # Achievement pages
│   │   │   ├── group-bookings/ # Group booking management
│   │   │   ├── group-invitations/ # Invitation handling
│   │   │   ├── resources/  # Resource hub
│   │   │   ├── surveys/    # Volunteer surveys
│   │   │   ├── profile/    # User profile
│   │   │   ├── login/      # Login page
│   │   │   ├── register/   # Registration page
│   │   │   ├── verify-email/ # Email verification
│   │   │   ├── forgot-password/ # Password reset request
│   │   │   └── reset-password/  # Password reset completion
│   │   ├── components/     # React components
│   │   │   ├── ui/         # shadcn/ui base components (40+ components)
│   │   │   ├── forms/      # Form components (user-profile-form)
│   │   │   ├── admin/      # Admin-specific components
│   │   │   └── auto-accept/ # Auto-accept rule components
│   │   ├── generated/      # Prisma generated client (output of prisma:generate)
│   │   ├── lib/            # Utilities, auth, prisma client
│   │   │   ├── services/   # Business logic (campaign-monitor, shift-service)
│   │   │   ├── actions/    # Server actions (password-reset)
│   │   │   └── utils/      # Utility functions (password-validation)
│   │   └── types/          # TypeScript types (next-auth.d.ts, survey.ts, etc.)
│   ├── prisma/             # Schema and migrations
│   ├── tests/              # Test files
│   │   ├── e2e/            # Playwright e2e tests
│   │   └── fixtures/       # Test fixtures
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
│   ├── src/content/docs/   # Documentation content
│   └── widget/             # Embeddable widget (built before docs)
│
├── .github/workflows/      # CI/CD workflows
│   ├── ci.yml              # Main CI (lint, typecheck, test, build, e2e)
│   ├── test.yml            # Test runner
│   ├── docs.yml            # Docs deployment
│   ├── docs-check.yml      # Docs validation
│   ├── version-bump.yml    # Automatic version bumping
│   ├── claude.yml          # Claude automation
│   └── claude-code-review.yml # Claude code review
├── CHANGELOG.md            # Auto-generated changelog
└── CLAUDE.md               # This file
```

## Cross-App Architecture

### API Boundary

The mobile app (`mobile/`) consumes the web app's REST API (`web/src/app/api/`). Key endpoint groups:

- `/api/auth/[...nextauth]` — NextAuth (web sessions)
- `/api/auth/mobile/login` — Mobile JWT authentication
- `/api/auth/register` — User registration
- `/api/auth/verify-email` — Email verification
- `/api/auth/complete-migration` — Migration flow completion
- `/api/shifts/*` — Shift listing and management
- `/api/profile` — User profile
- `/api/achievements` — Gamification and achievement tracking
- `/api/leaderboard` — Volunteer leaderboard
- `/api/friends/*` — Friends, requests, activity, privacy, recommended
- `/api/group-bookings/*` — Group booking system
- `/api/group-invitations/*` — Invitation token handling
- `/api/notifications` — Notification system with SSE
- `/api/passkey/*` — WebAuthn/Passkey registration and authentication
- `/api/resources` — Resource hub content
- `/api/surveys/*` — Survey system
- `/api/site-settings` — Dynamic site configuration
- `/api/migration/*` — Data migration from legacy system
- `/api/newsletter-lists` — Newsletter subscription management
- `/api/admin/*` — Admin operations (protected, 25+ sub-routes)

### Authentication

**Web**: NextAuth with multiple OAuth providers (Google, Facebook, Apple, Credentials) plus WebAuthn/Passkey support. Use `getServerSession(authOptions)` in server components/API routes. Auth config in `src/lib/auth-options.ts`.

**Mobile**: JWT-based auth stored in `expo-secure-store`. The `AuthGate` component in `mobile/components/auth-gate.tsx` renders `LoginScreen` directly when unauthenticated (no navigation redirects — avoids infinite loops). Auth state managed via `mobile/lib/auth.ts`.

**Bot Protection**: Bot detection via `botid` library in `src/lib/bot-protection.ts` with client component in `src/components/bot-protection-client.tsx`.

### Shared Design Language

Both apps use the same brand fonts and colors:
- **Fonts**: Libre Franklin (body) + Fraunces (headings)
- **Colors**: Same brand palette defined in `mobile/constants/theme.ts` (mobile) and Tailwind config (web)
- **Te Reo Māori**: Weave in throughout — "Kia ora", "mahi", "whānau", "Ka pai", "Ngā mihi"

## Web App (`web/`) Details

### Tech Stack

- **Next.js 16** with App Router and React 19 (React Compiler enabled via babel plugin)
- **TypeScript 5** with strict configuration
- **Prisma 7** ORM with PostgreSQL (client output to `src/generated/`)
- **NextAuth.js v4** for authentication (with WebAuthn/Passkey via `@simplewebauthn`)
- **Tailwind CSS v4** + **shadcn/ui** components
- **motion.dev** (v12) for animations
- **Zod v4** for validation schemas
- **React Hook Form** + `@hookform/resolvers` for forms
- **date-fns v4** with `@date-fns/tz` for timezone-aware date handling
- **Supabase** for file storage (profile photos)
- **PostHog** for analytics
- **Campaign Monitor** for transactional emails
- **Vitest v4** for unit testing, **Playwright** for e2e
- **ApexCharts** via `react-apexcharts` for admin analytics

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

Rate limiting available via `src/lib/rate-limit.ts`.

SSE (Server-Sent Events) for real-time notifications — utilities in `src/lib/sse-*.ts` and `better-sse`.

### Database Schema (34 Models)

**Core**:
- **User** — Volunteer profiles with emergency contacts, role (`VOLUNTEER`/`ADMIN`), volunteer grade
- **Passkey** / **WebAuthnChallenge** — WebAuthn authentication
- **Shift** / **ShiftType** / **ShiftTemplate** — Shift scheduling with templates
- **Signup** — Shift registrations with status tracking (`SignupStatus` enum)
- **Location** — Restaurant locations

**Gamification & Social**:
- **Achievement** / **UserAchievement** — Achievement system with categories (`MILESTONE`, `DEDICATION`, `IMPACT`, `SPECIALIZATION`)
- **Friendship** / **FriendRequest** — Friends system with privacy controls (`FriendVisibility`)
- **GroupBooking** / **GroupInvitation** — Group booking workflow

**Admin & Management**:
- **AdminNote** — Notes on volunteers
- **CustomLabel** / **UserCustomLabel** — Custom volunteer labels/tags
- **AutoAcceptRule** / **AutoApproval** — Automatic shift approval rules
- **RegularVolunteer** / **RegularSignup** — Regular volunteer scheduling
- **RestaurantManager** — Manager assignments
- **MealsServed** — Meal count tracking per shift
- **Resource** — Resource hub content (`ResourceType`, `ResourceCategory` enums)
- **SiteSetting** — Dynamic site configuration

**Communications**:
- **Notification** / **NotificationGroup** / **NotificationGroupMember** — Notification system
- **ShortageNotificationLog** — Shift shortage alerts
- **NewsletterList** — Newsletter subscription lists

**Surveys**:
- **Survey** / **SurveyAssignment** / **SurveyToken** / **SurveyResponse** — Full survey system with triggers

**Key Enums**: `Role`, `SignupStatus`, `VolunteerGrade`, `NotificationType`, `AchievementCategory`, `GroupBookingStatus`, `FriendshipStatus`, `Frequency`, `CriteriaLogic`, `ResourceType`, `ResourceCategory`, `SurveyTriggerType`

### Achievement System

Automatic unlocking based on shift counts (MILESTONE), consecutive months (DEDICATION), hours (IMPACT), and shift types (SPECIALIZATION). Processing in `/api/achievements/route.ts`. Calculator logic in `src/lib/achievement-calculator.ts`.

### Group Booking System

Volunteers can create group bookings, send invitations, manage assignments, and handle approval workflows.

### Notification System

Real-time notifications via SSE (Server-Sent Events). Server-side broadcasting in `src/lib/sse-broadcaster.ts`, security in `src/lib/sse-security.ts`. Notification helpers in `src/lib/notification-helpers.ts` and `src/lib/notification-service.ts`.

### Email System

Transactional emails via Campaign Monitor (`src/lib/services/campaign-monitor.ts`). Email service abstraction in `src/lib/email-service.ts`. Email verification flow in `src/lib/email-verification.ts`.

### File Storage

Profile photos and uploads stored in Supabase Storage. Client in `src/lib/supabase.ts`, utilities in `src/lib/storage.ts` and `src/lib/storage-utils.ts`.

### Animation System

Uses **motion.dev** — not CSS animations. All variants in `src/lib/motion.ts`. Motion wrapper components: `MotionButton`, `MotionCard`, `MotionDialog`, `MotionStatCard`, `MotionForm`, `MotionSpinner`, `MotionPageContainer`, `MotionContentCard`. Dashboard wrappers in `src/components/dashboard-animated.tsx`. Admin motion in `src/components/motion-admin.tsx`. Animations auto-disabled during e2e tests via `.e2e-testing` class.

### SEO

- Sitemap: `src/app/sitemap.ts`, Robots: `src/app/robots.ts`, Metadata: `src/lib/seo.ts`
- Public pages (indexable): `/`, `/login`, `/register`, `/shifts`, `/resources`
- Private pages (noindex): `/dashboard`, `/profile`, `/admin/*`, `/api/*`
- Use `buildPageMetadata()` from `@/lib/seo` for new public pages

## Mobile App (`mobile/`) Details

### Tech Stack

- **React Native 0.83** with **Expo 55** (new architecture enabled)
- **expo-router 55** for file-based navigation
- **expo-secure-store** for JWT storage
- **TypeScript** with typed routes
- **Zustand** for state management
- **react-native-reanimated** for animations
- **expo-image** for optimized image loading
- **expo-haptics** for haptic feedback

### Design System

See `mobile/STYLE_GUIDE.md` for the complete reference. Key principles:

- **Typography**: Use `ThemedText` component — `title` (Fraunces 28pt), `heading` (22pt), `subtitle` (Libre Franklin 18pt semi-bold), `default` (16pt)
- **Colors**: Import `Brand`, `Colors`, `FontFamily` from `@/constants/theme`
- **Emojis**: Use freely for warmth — they replace icon-only indicators
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
- `useFriendProfile(id)` — Individual friend profile
- `useFeed()` — Activity feed

## Testing Guidelines

### Unit Tests (Vitest — `web/` only)

- Place test files alongside source: `*.test.ts` / `*.test.tsx`
- `globals: true` — `describe`, `it`, `expect` auto-imported
- Mock Prisma and externals via `src/lib/test-setup.ts`
- Use for: pure functions, data transformations, validation, business logic
- Existing test files: `auto-accept-rules.test.ts`, `calendar-utils.test.ts`, `engagement.test.ts`, `mobile-auth.test.ts`, `placeholder-utils.test.ts`, `signup-utils.server.test.ts`, `survey-tokens.test.ts`, `survey-triggers.test.ts`

### E2E Tests (Playwright — `web/` only)

- Tests in `web/tests/e2e/` (50+ spec files)
- **ALWAYS** run with `--project=chromium` to avoid cross-browser flakiness
- Shared utilities in `web/tests/e2e/base.ts`
- Test fixtures in `web/tests/fixtures/`
- Use `data-testid` attributes — descriptive, hierarchical: `section-element-type`
- Use for: full user workflows, auth flows, admin operations

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** — Runs on PRs and pushes to `main` (paths: `web/**`). Jobs: lint, typecheck, unit tests, build, e2e tests. Uses PostgreSQL service container.
- **test.yml** — Dedicated test runner
- **docs.yml** / **docs-check.yml** — Documentation site build and validation
- **version-bump.yml** — Automatic semantic version bumping via PR labels
- **claude.yml** / **claude-code-review.yml** — Claude AI automation

## Versioning

Automatic semantic versioning via PR labels:

- `version:major` — Breaking changes
- `version:minor` — New features
- `version:patch` — Bug fixes, refactoring
- `version:skip` — Docs, tests only

**IMPORTANT**: Always add a version label when creating PRs: `gh pr edit <PR> --add-label "version:TYPE"`

Current version: `0.112.8` (in `web/package.json`).

## Environment Variables

Copy `web/.env.example` to `web/.env` for local development (or use `npm run local-setup`).

### Required (`web/.env`):

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Random secret for NextAuth
- `NEXTAUTH_URL` — Application URL (default: `http://localhost:3000`)
- `TZ` — Timezone (`Pacific/Auckland`)

### Optional (`web/.env`):

- **OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`
- **PostHog Analytics**: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **Supabase Storage**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Campaign Monitor**: `CAMPAIGN_MONITOR_API_KEY`, plus template IDs for migration, cancellation, confirmation, verification, and invitation emails

### Mobile (`mobile/`):
- API base URL configured in `mobile/lib/api.ts`

## Development Tips

1. **Type Safety**: Use generated Prisma types from `src/generated/` for database operations
2. **Server Components**: Prefer Server Components for data fetching (web)
3. **Error Handling**: API routes should return appropriate HTTP status codes
4. **Session Checks**: Always verify session and role for protected operations
5. **Database Queries**: Include necessary relations in Prisma queries to avoid N+1
6. **Animations**: Use motion.dev components in web, not CSS animations
7. **Mobile fonts**: Always use `FontFamily.*` tokens, never raw `fontWeight`
8. **Prisma Client**: Generated to `src/generated/` (not default location) — run `npm run prisma:generate` after schema changes
9. **Date Handling**: Use `date-fns` with `@date-fns/tz` for timezone-aware operations; always consider NZ timezone
10. **Form Validation**: Use Zod schemas (`src/lib/validation-schemas.ts`) with React Hook Form
11. **Email Templates**: Email IDs are configured as environment variables; newsletter lists managed dynamically via admin

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
- **[Admin User Management](web/docs/admin-user-management.md)** — Admin operations guide
- **[Authentication & Authorization](web/docs/authentication-authorization.md)** — Auth system details
- **[Profile Images](web/docs/profile-images.md)** — Image upload and storage
- **[Resource Hub](web/docs/resource-hub.md)** — Resource system documentation
