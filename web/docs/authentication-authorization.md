# Authentication & Authorization Guide

This guide covers the centralized authentication and authorization system used throughout the Volunteer Portal application.

## Architecture Overview

The application uses a two-layer security approach:

1. **Middleware** - Route-level protection at the edge
2. **Auth Utilities** - Component-level conditional rendering

### Middleware-Based Route Protection

All routes are protected by Next.js middleware (`middleware.ts`) with a **secure-by-default** approach:

- **Default**: All routes require admin access
- **Explicit allowlisting**: Public and user routes must be specifically declared

## Route Categories

### Public Routes (No Authentication Required)
```typescript
public: [
  "/",                    // Home page
  "/login",               // Login page  
  "/register",            // Registration page
  "/shifts",              // Public shifts browsing
  "/api/auth",            // NextAuth endpoints
]
```

### User Routes (Login Required, Volunteer Access)
```typescript
user: [
  "/dashboard",           // User dashboard
  "/profile",             // Profile management
  "/achievements",        // Achievement tracking
  "/friends",             // Friends system
  "/api/profile",         // Profile API
  "/api/achievements",    // Achievement API
  "/api/friends",         // Friends API
  "/api/notifications",   // Notification API
]
```

### Admin Routes (Admin Role Required)
```typescript
// All other routes default to admin-only access including:
// - /admin/*             (Admin dashboard)
// - /api/admin/*         (Admin APIs)
// - Any new routes not explicitly allowlisted
```

## Implementation

### Middleware Configuration

The middleware automatically:
- Checks authentication status using NextAuth tokens
- Validates user roles for protected routes
- Redirects unauthorized users to appropriate pages
- Preserves the intended destination for post-login redirects

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const requiredLevel = getRequiredAuthLevel(pathname)
  
  // Route protection logic...
}
```

### Adding New Routes

**For Public Routes:**
```typescript
// Add to middleware.ts public array
public: [
  "/new-public-route",
]
```

**For User Routes:**
```typescript  
// Add to middleware.ts user array
user: [
  "/new-user-route",
]
```

**For Admin Routes:**
No action needed - defaults to admin access

## Component-Level Authentication

Use the auth utilities for conditional rendering within components:

```typescript
import { getAuthInfo } from "@/lib/auth-utils"

export default async function MyComponent() {
  const { isLoggedIn, isAdmin, user } = await getAuthInfo()
  
  return (
    <div>
      {isLoggedIn && <UserContent />}
      {isAdmin && <AdminContent />}
      {user && <p>Welcome, {user.name}!</p>}
    </div>
  )
}
```

### Available Auth Helpers

```typescript
// Get complete auth information
const { session, user, isLoggedIn, isAdmin } = await getAuthInfo()

// Helper functions
const loggedIn = await authHelpers.isLoggedIn()
const admin = await authHelpers.isAdmin()  
const currentUser = await authHelpers.getCurrentUser()
```

## Page Protection Patterns

### Protected Pages
```typescript
export default async function AdminPage() {
  // No auth checks needed - middleware handles protection
  // Page content...
}
```

### Conditional UI Rendering
```typescript
export default async function FlexiblePage() {
  const { isLoggedIn, isAdmin } = await getAuthInfo()
  
  return (
    <div>
      <h1>Welcome</h1>
      {isLoggedIn ? (
        <UserDashboard />
      ) : (
        <PublicContent />
      )}
      {isAdmin && <AdminTools />}
    </div>
  )
}
```

## API Route Protection

### Automatic Protection
API routes are automatically protected by middleware based on their path patterns.

### Manual Checks (When Needed)
For granular permissions within protected routes:

```typescript
// app/api/admin/users/route.ts
export async function POST(request: NextRequest) {
  // Middleware already verified admin access
  // Additional checks if needed:
  const { user } = await getAuthInfo()
  
  if (user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  }
  
  // API logic...
}
```

## Security Benefits

### Secure by Default
- ✅ New routes are automatically protected
- ✅ Cannot accidentally expose admin functionality  
- ✅ Explicit allowlisting forces conscious security decisions
- ✅ Centralized configuration reduces inconsistencies

### Performance Benefits
- ✅ Authentication happens at middleware level (before page rendering)
- ✅ Reduced redundant auth checks across components
- ✅ Single source of truth for route permissions

## Testing Authentication

### Route Access Testing
```typescript
// Test public route access
test("public routes accessible without auth", async () => {
  const response = await fetch("/shifts")
  expect(response.status).toBe(200)
})

// Test protected route redirects
test("admin routes redirect when not authorized", async () => {
  const response = await fetch("/admin")
  expect(response.status).toBe(302) // Redirect to login
})
```

### Component Testing
```typescript
// Test conditional rendering
test("shows admin content for admin users", async () => {
  // Mock admin session
  render(<AdminComponent />)
  expect(screen.getByText("Admin Tools")).toBeInTheDocument()
})
```

## Troubleshooting

### Common Issues

**Route not accessible:**
- Check if route is properly categorized in middleware.ts
- Verify user has correct role for route category

**Infinite redirects:**
- Ensure login page is in public routes
- Check callback URL configuration

**Auth state not updating:**
- Session changes require browser refresh or session update trigger
- Use NextAuth session update() for real-time updates

### Debug Authentication
```typescript
// Add to page for debugging
const auth = await getAuthInfo()
console.log("Auth state:", auth)
```

## Migration from Old System

When updating existing pages:

1. Remove manual `getServerSession` and redirect logic
2. Add route to appropriate middleware category if needed
3. Use `getAuthInfo()` for conditional UI rendering only
4. Update tests to account for middleware protection

## Best Practices

1. **Route Security**: Always default to most restrictive access level
2. **Conditional UI**: Use auth utilities for showing/hiding content
3. **API Protection**: Leverage middleware protection, add granular checks only when needed
4. **Testing**: Test both authorized and unauthorized access patterns
5. **Documentation**: Update this guide when adding new route categories