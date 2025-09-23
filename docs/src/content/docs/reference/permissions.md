---
title: Permissions & Access Control
description: Technical reference for permissions, access control, and route protection
---

# Permissions & Access Control

This page provides technical details about permission levels and access controls in the volunteer portal system.

## Permission Levels

### Database Roles

- `VOLUNTEER` - Standard user role with access to dashboard, profile, and shift features
- `ADMIN` - Administrative access role with full system access

### Route Categories

#### Public Routes (No Authentication)

- Home page (`/`)
- Authentication pages (`/login`, `/register`)
- Public shift browsing (`/shifts`)
- Public API endpoints (`/api/auth/*`)

#### User Routes (Volunteer Access)

- User dashboard (`/dashboard`)
- Profile management (`/profile/*`)
- Achievement tracking (`/achievements`)
- Friends system (`/friends`)
- User-specific API endpoints

#### Admin Routes (Admin Access Only)

- Admin dashboard (`/admin/*`)
- Admin API endpoints (`/api/admin/*`)
- **All other routes default to admin-only access**

## Route Protection System

### Middleware-Based Security

The system uses Next.js middleware with a **secure-by-default** approach:

1. **Default to Admin Access**: All routes require admin permissions unless explicitly allowlisted
2. **Edge Protection**: Authentication checks happen before page rendering
3. **Automatic Redirects**: Unauthorized users are redirected to appropriate pages
4. **Preserved Destinations**: Intended destinations are preserved for post-login redirects

### Security Benefits

- ✅ New routes are automatically protected
- ✅ Cannot accidentally expose admin functionality
- ✅ Explicit allowlisting forces conscious security decisions
- ✅ Centralized configuration reduces inconsistencies

## API Endpoint Security

### Automatic Protection

API routes are automatically protected by middleware based on their path patterns.

### Manual Checks

Additional granular permissions can be implemented within protected routes:

```typescript
const { user } = await getAuthInfo();
if (user?.role !== "SUPER_ADMIN") {
  return NextResponse.json(
    { error: "Insufficient permissions" },
    { status: 403 }
  );
}
```
