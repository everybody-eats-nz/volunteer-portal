# CLAUDE.md - App Router Guidelines

This file provides guidance to Claude Code for working with the Next.js App Router in this directory.

## Overview

This directory contains all Next.js App Router pages, API routes, and layouts for the Volunteer Portal application.

## Directory Structure

```
app/
├── api/                # API route handlers
│   ├── auth/          # NextAuth.js endpoints
│   ├── admin/         # Admin-only API routes
│   ├── shifts/        # Shift management endpoints
│   ├── profile/       # User profile endpoints
│   └── achievements/  # Achievement processing
├── (auth)/            # Authentication pages group
│   ├── login/         # Login page
│   ├── register/      # Registration page
│   └── reset/         # Password reset
├── admin/             # Admin dashboard pages
│   ├── volunteers/    # Volunteer management
│   ├── shifts/        # Shift scheduling
│   └── reports/       # Analytics & reports
├── dashboard/         # Main user dashboard
├── shifts/            # Public shift browsing
└── profile/           # User profile management
```

## Key Patterns

### Server Components by Default

All components are Server Components unless marked with "use client":

```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}

// Client Component (when needed)
"use client"
export default function InteractivePage() {
  const [state, setState] = useState()
  return <div onClick={() => setState(true)}>Interactive</div>
}
```

### API Route Structure

Follow consistent patterns for API routes:

```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  try {
    const data = await prisma.resource.findMany()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
```

### Protected Routes Pattern

Routes are now automatically protected by middleware. For additional granular permissions within protected routes:

```typescript
// app/api/admin/*/route.ts
import { getAuthInfo } from "@/lib/auth-utils"

const { user } = await getAuthInfo()

// Middleware already verified admin access
// Additional checks if needed:
if (user?.role !== "SUPER_ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### Middleware-Based Authentication

The application uses centralized middleware for route protection with a secure-by-default approach:

- **All routes require admin access by default**
- **Public and user routes must be explicitly allowlisted**
- **Route protection happens at the edge before page rendering**

See `middleware.ts` for route configuration and `src/lib/auth-utils.ts` for component-level helpers.

### Loading & Error States

Use loading.tsx and error.tsx for better UX:

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div>Loading dashboard...</div>
}

// app/dashboard/error.tsx
"use client"
export default function Error({ error, reset }: { error: Error, reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Metadata

Define metadata for SEO:

```tsx
// app/page.tsx
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Volunteer Portal - Home",
  description: "Manage your volunteer shifts and achievements",
}
```

## Authentication Flow

1. All auth routes are in `(auth)` group for shared layout
2. Use `getServerSession(authOptions)` in Server Components
3. Redirect incomplete profiles to `/profile/complete`
4. Check role permissions before rendering admin content

## Data Fetching Best Practices

1. **Fetch in Server Components**: Reduce client-side waterfalls
2. **Use Parallel Fetching**: Fetch multiple resources simultaneously
3. **Implement Proper Caching**: Use Next.js caching strategies
4. **Handle Errors Gracefully**: Always provide fallback UI

Example parallel fetching:

```tsx
export default async function Dashboard() {
  const [shifts, achievements, profile] = await Promise.all([
    fetchShifts(),
    fetchAchievements(),
    fetchProfile()
  ])
  
  return <DashboardView data={{ shifts, achievements, profile }} />
}
```

## Form Handling

Use Server Actions for forms when possible:

```tsx
// app/admin/volunteers/actions.ts
"use server"

export async function updateVolunteer(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  
  // Process form data
  const data = Object.fromEntries(formData)
  
  // Update database
  await prisma.volunteer.update({
    where: { id: data.id },
    data: { /* updates */ }
  })
  
  // Revalidate cache
  revalidatePath("/admin/volunteers")
}
```

## Testing Considerations

When adding new routes or modifying existing ones:

1. Add appropriate `data-testid` attributes for e2e tests
2. Ensure proper error handling for all edge cases
3. Test both authenticated and unauthenticated access
4. Verify role-based access control works correctly

## Common Issues & Solutions

- **Hydration Errors**: Ensure consistent rendering between server and client
- **Auth State**: Always check session before accessing protected data
- **Data Mutations**: Use Server Actions or API routes, not direct database calls in components
- **Caching Issues**: Use `revalidatePath` or `revalidateTag` after mutations

## Important Reminders

- Never expose sensitive data in client components
- Always validate and sanitize user input
- Use proper HTTP status codes in API responses
- Include loading and error states for better UX
- Follow the established patterns in existing code