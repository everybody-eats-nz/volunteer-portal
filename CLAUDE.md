# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Everybody Eats Volunteer Portal - a Next.js application for managing volunteers at a charitable restaurant. The main application is in the `/web/` directory.

## Essential Commands

### Development

```bash
cd web
npm install
npm run dev        # Start development server on http://localhost:3000
```

### Database

```bash
cd web
npm run prisma:generate  # Generate Prisma client after schema changes
npm run prisma:migrate   # Run migrations in development
npm run prisma:seed      # Seed database with initial data
npm run prisma:reset     # Reset database (drops data, runs migrations, and seeds automatically)
npm run prisma:deploy    # Deploy migrations to production
```

### Testing

#### Unit Tests (Vitest)

```bash
cd web
npm run test         # Run unit tests in watch mode
npm run test:ui      # Run tests with Vitest UI
npm run test:run     # Run tests once (CI mode)
```

**Unit Testing Guidelines**:
- Use Vitest for testing utility functions, business logic, and isolated components
- Test files should be named `*.test.ts` or `*.test.tsx` and placed alongside the code they test
- Use `describe` blocks to group related tests
- Follow the existing pattern in `src/lib/calendar-utils.test.ts` for consistency
- Mock Prisma client and external dependencies in test setup (`src/lib/test-setup.ts`)
- Use `globals: true` in vitest.config.ts, so `describe`, `it`, `expect` are auto-imported

**When to use unit tests**:
- Pure functions and utility libraries
- Data transformation logic
- Validation functions
- Calendar/date utilities
- Complex business logic that doesn't require DOM or database

#### E2E Tests (Playwright)

```bash
cd web
npm run test:e2e                # Run all Playwright e2e tests
npm run test:e2e:ui              # Run tests with UI mode
npm run test:e2e:ci              # Run tests in CI mode (Chromium only)
npx playwright test test.spec.ts --project=chromium # Run specific test in Chromium only (RECOMMENDED)
```

**Important**: ALWAYS run e2e tests in Chromium only using `--project=chromium` flag. This avoids cross-browser compatibility issues and provides cleaner debugging output. Running tests across all browsers can cause timeouts and false positives.

**When to use e2e tests**:
- Full user workflows
- Page interactions and navigation
- Form submissions
- Authentication flows
- Admin dashboard operations

### Build & Lint

```bash
cd web
npm run build     # Build production bundle
npm run lint      # Run ESLint
```

## Architecture Overview

### Tech Stack

- **Next.js 16.0.3** with App Router - React framework
- **TypeScript** with strict configuration
- **Prisma ORM** with PostgreSQL
- **NextAuth.js** for authentication (OAuth + credentials)
- **Tailwind CSS v4** + **shadcn/ui** components
- **Vitest** for unit testing
- **Playwright** for e2e testing

### Directory Structure

```
web/
├── src/
│   ├── app/              # Next.js App Router pages and API routes
│   │   ├── api/         # API route handlers
│   │   ├── admin/       # Admin dashboard pages
│   │   ├── login/       # Authentication pages
│   │   ├── register/    # User registration
│   │   ├── dashboard/   # User dashboard
│   │   ├── profile/     # Profile management
│   │   └── shifts/      # Shift browsing and management
│   ├── components/      # React components
│   │   ├── ui/         # shadcn/ui components
│   │   └── forms/      # Form components
│   ├── lib/            # Utilities and shared code
│   │   ├── auth-options.ts  # NextAuth configuration
│   │   ├── prisma.ts        # Prisma client singleton
│   │   └── utils.ts         # Utility functions
│   └── types/          # TypeScript type definitions
├── prisma/             # Database schema and migrations
├── tests/              # Playwright e2e tests
├── docs/               # Documentation files
└── public/             # Static assets
```

### Key API Patterns

All API routes follow Next.js App Router conventions in `src/app/api/`:

- Authentication: `/api/auth/[...nextauth]` (NextAuth.js)
- User registration: `/api/auth/register`
- Admin operations: `/api/admin/*` (protected routes)
- Shift management: `/api/shifts/*`
- Group bookings: `/api/group-bookings/*`
- User profiles: `/api/profile`
- Achievements: `/api/achievements`

Protected routes check session role:

```typescript
const session = await getServerSession(authOptions);
if (session?.user?.role !== "ADMIN") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

### Database Schema Key Models

- **User**: Volunteer profiles with emergency contacts, role (VOLUNTEER/ADMIN)
- **Shift/ShiftType**: Shift scheduling system
- **Signup**: Shift registrations with status tracking
- **Achievement**: Gamification system with multiple criteria types

Always use Prisma client through the singleton in `src/lib/prisma.ts`:

```typescript
import { prisma } from "@/lib/prisma";
```

### Authentication Flow

1. NextAuth configured with multiple providers (Google, Facebook, Apple, Credentials)
2. OAuth users must complete profile after first login
3. Session includes user role and profile completion status
4. Use `getServerSession(authOptions)` in server components/API routes

### Achievement System

Complex gamification with automatic unlocking based on:

- Shift counts (MILESTONE type)
- Consecutive months (DEDICATION type)
- Hours volunteered (IMPACT type)
- Specific shift types (SPECIALIZATION type)

Achievement processing happens in `/api/achievements/route.ts`

### Group Booking System

Advanced shift assignment system allowing volunteers to:

- Create group bookings for shifts with multiple volunteers
- Send invitations to other volunteers via email/link
- Manage group member assignments and roles
- Handle approval workflows for group bookings

Group booking features are integrated throughout the admin dashboard and volunteer interface.

### Testing Approach

#### Unit Testing with Vitest

Unit tests in `/web/src/**/*.test.ts` cover:

- Utility functions (calendar, date formatting, etc.)
- Business logic and data transformations
- Validation functions
- Pure functions that don't require DOM or database

**Writing Unit Tests**:

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./my-module";

describe("myFunction", () => {
  it("should do something specific", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });

  it("should handle edge cases", () => {
    expect(myFunction("")).toBe("");
    expect(myFunction(null)).toBeNull();
  });
});
```

**Vitest Configuration**:
- Config file: `vitest.config.ts`
- Setup file: `src/lib/test-setup.ts` (mocks Prisma client and modules)
- Environment: Node
- Globals enabled: `describe`, `it`, `expect` are auto-imported
- E2E tests excluded from Vitest (handled by Playwright)

#### E2E Testing with Playwright

E2e tests in `/web/tests/e2e/` cover:

- Authentication flows (login, register)
- Admin dashboard functionality (user management, shift management)
- Volunteer workflows (shift browsing, signups, profile management)
- Group booking system
- Mobile navigation and responsive design

**Test ID Guidelines**:

- Use `data-testid` attributes for reliable element selection in tests
- Prefer testids over text-based selectors to avoid strict mode violations
- Use descriptive, hierarchical naming: `section-element-type` (e.g., `personal-info-heading`, `emergency-contact-section`)
- Add testids to:
  - Section headings and containers
  - Interactive elements (buttons, links, forms)
  - Key content areas that tests need to verify
  - Elements that might have duplicate text content

Example testid usage:

```tsx
<h2 data-testid="personal-info-heading">Personal Information</h2>
<div data-testid="personal-info-section">
  <span data-testid="personal-info-name-label">Name</span>
</div>
<Button data-testid="browse-shifts-button" asChild>
  <Link href="/shifts">Browse Shifts</Link>
</Button>
```

**Testing Best Practices**:
- Write unit tests for business logic and utilities
- Write e2e tests for user workflows and integration
- Run unit tests (`npm run test:run`) before committing
- Run relevant e2e tests before committing changes that affect user flows
- Use `--project=chromium` flag for faster e2e test execution

## Animation System

This project uses **motion.dev** for all animations. We've migrated from CSS animations and tw-animate-css to motion.dev for better performance and developer experience.

### Animation Guidelines

1. **Use Motion.dev Components**: Import motion wrappers instead of using CSS animations
   ```tsx
   // ❌ Don't use CSS classes
   <div className="animate-fade-in animate-slide-up">
   
   // ✅ Use motion components
   import { motion } from "motion/react";
   <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
   ```

2. **Animation Utilities**: All animation variants are in `/src/lib/motion.ts`
   - `fadeVariants` - Fade in/out animations
   - `slideUpVariants` - Slide up entrance animations
   - `staggerContainer` & `staggerItem` - For lists and grids
   - `cardHoverVariants` - Card hover effects
   - `buttonHoverVariants` - Button interactions

3. **Motion Components Available**:
   - `MotionButton` - Enhanced button with hover/tap animations
   - `MotionCard` - Card with hover lift effect
   - `MotionDialog` - Dialog with entrance/exit animations
   - `MotionStatCard` - Dashboard stat cards with stagger
   - Loading skeletons in `/src/components/loading-skeleton.tsx`

4. **Dashboard Animations**: Use the wrappers in `/src/components/dashboard-animated.tsx`
   - `StatsGrid` - Grid container with stagger
   - `ContentSection` - Section with configurable delay
   - `ContentGrid` & `BottomGrid` - Layout containers

5. **Page Transitions**: For auth pages, use `/src/components/auth-animated.tsx`
   - `AuthPageContainer` - Page fade-in
   - `AuthCard` - Form card slide-up
   - `FormStepTransition` - Multi-step form transitions

6. **Testing with Animations**: 
   - Animations are automatically disabled during e2e tests via `.e2e-testing` class
   - Use `data-testid` attributes for reliable element selection

### Adding New Animations

1. Define variants in `/src/lib/motion.ts`
2. Create motion wrapper components as needed
3. Maintain grid/flex layouts by avoiding unnecessary wrapper divs
4. Test animations across different screen sizes

## SEO & Search Optimization

This application implements comprehensive SEO following Next.js 16 best practices.

### Key Components

- **Sitemap**: Auto-generated at `/sitemap.xml` via `src/app/sitemap.ts`
- **Robots**: Auto-generated at `/robots.txt` via `src/app/robots.ts`
- **Metadata**: Centralized utilities in `src/lib/seo.ts`
- **Structured Data**: Organization and Event schemas via JSON-LD

### Public vs Private Pages

**Indexable** (robots: index, follow):
- `/` - Homepage
- `/login` - Sign in
- `/register` - Registration
- `/shifts` - Shift browsing

**Non-Indexable** (robots: noindex, nofollow):
- All authenticated pages (`/dashboard`, `/profile`, `/achievements`, `/friends`, `/resources`)
- All admin pages (`/admin/*`)
- All API routes (`/api/*`)

### Adding SEO to New Pages

For new public pages:

```typescript
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Page Title",
  description: "Page description (150-160 chars)",
  path: "/page-path",
});
```

For dynamic pages, use `generateMetadata`:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  // Fetch data and return metadata
  return buildPageMetadata({
    title: dynamicTitle,
    description: dynamicDescription,
    path: "/page-path",
  });
}
```

For authenticated/private pages:

```typescript
export const metadata: Metadata = {
  title: "Page Title",
  robots: {
    index: false,
    follow: false,
  },
};
```

### Testing SEO

**Development:**
```bash
npm run dev
# Visit http://localhost:3000/sitemap.xml
# Visit http://localhost:3000/robots.txt
# Inspect <head> tags on each public page
```

**Validation Tools:**
- [Google Rich Results Test](https://search.google.com/test/rich-results) - Test structured data
- [Schema Markup Validator](https://validator.schema.org/) - Validate JSON-LD
- [Facebook OG Debugger](https://developers.facebook.com/tools/debug/) - Test Open Graph tags
- [Twitter Card Validator](https://cards-dev.twitter.com/validator) - Test Twitter Cards

**Monitoring:**
- Google Search Console for indexing status and crawl errors
- Core Web Vitals via Vercel Speed Insights
- Organic traffic via PostHog

### Documentation

For comprehensive SEO guidelines, see **[SEO Guide](web/docs/seo-guide.md)**.

## Development Tips

1. **Type Safety**: Use generated Prisma types for database operations
2. **Server Components**: Prefer Server Components for data fetching
3. **Error Handling**: API routes should return appropriate HTTP status codes
4. **Session Checks**: Always verify session and role for protected operations
5. **Database Queries**: Include necessary relations in Prisma queries to avoid N+1 problems
6. **Animations**: Use motion.dev components, not CSS animations

## Versioning System

This project uses automatic semantic versioning based on PR labels:

- `version:major` - Breaking changes (1.0.0 → 2.0.0)
- `version:minor` - New features, backward compatible (1.0.0 → 1.1.0)
- `version:patch` - Bug fixes, small improvements (1.0.0 → 1.0.1)
- `version:skip` - No version bump (documentation, tests, etc.)

When PRs are merged to main, the GitHub Action automatically:

- Updates `web/package.json` version
- Creates Git tags and GitHub releases
- Generates changelog entries

**IMPORTANT**: When creating PRs, ALWAYS add the appropriate version label using `gh pr edit <PR_NUMBER> --add-label "version:TYPE"`. Choose the label based on:
- Bug fixes, CI improvements, refactoring: `version:patch`
- New features, enhancements: `version:minor`
- Breaking changes: `version:major`
- Documentation only: `version:skip`

Example: `gh pr edit 33 --add-label "version:patch"`

## Environment Variables

Required in `.env.local`:

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret for NextAuth
- `NEXTAUTH_URL`: Application URL
- OAuth provider credentials (GOOGLE_CLIENT_ID, etc.)

## Detailed Documentation

For comprehensive guidelines specific to different areas of the codebase, see the documentation in `web/docs/`:

### Development Guides
- **[App Router Guide](web/docs/app-router-guide.md)** - Next.js App Router patterns, API routes, Server Components, authentication
- **[Component Development](web/docs/component-development.md)** - React component guidelines, shadcn/ui usage, styling with Tailwind
- **[UI Components System](web/docs/ui-components-system.md)** - Complete UI system guide with Tailwind, shadcn/ui, motion.dev, and inspiration resources (Magic UI, Animata, React Bits)
- **[Libraries & Utilities](web/docs/libraries-utilities.md)** - Shared utilities, services, auth patterns, validation schemas
- **[Database & Schema](web/docs/database-schema.md)** - Prisma best practices, migrations, query optimization
- **[Testing Guide](web/docs/testing-guide.md)** - Playwright e2e testing patterns, test utilities, data-testid conventions

### Setup & Configuration
- **[OAuth Setup](web/docs/oauth-setup.md)** - OAuth provider configuration and setup
- **[Profile Images](web/docs/profile-images.md)** - Profile image upload and management
- **[Resource Hub](web/docs/resource-hub.md)** - Document management system with Supabase Storage
- **[Versioning](web/docs/versioning.md)** - Semantic versioning and release process

### Administrative
- **[Admin User Management](web/docs/admin-user-management.md)** - User administration and management features

These guides provide detailed, domain-specific instructions for working in each area of the codebase and should be consulted when making changes to ensure consistency with established patterns.
