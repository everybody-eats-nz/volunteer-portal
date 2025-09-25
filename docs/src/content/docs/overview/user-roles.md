---
title: User Roles & Permissions
description: Understanding volunteer and administrator roles, permissions, and access levels in the system
---

The volunteer portal operates with two distinct user roles, each with specific permissions and access levels.

## Role Overview

### Volunteer Role
**Default role for all registered users**

**Access Permissions:**
- ✅ Personal dashboard and profile management
- ✅ Browse and sign up for available shifts  
- ✅ View personal shift calendar and history
- ✅ Create and manage group bookings
- ✅ Update availability preferences and emergency contacts

**Restricted Areas:**
- ❌ Admin dashboard and management interfaces
- ❌ User management and volunteer profiles (other users)
- ❌ Shift creation and editing capabilities
- ❌ System-wide analytics and reporting

### Administrator Role  
**Administrative access with full system control**

**Full Access Includes:**
- ✅ Everything volunteers can access
- ✅ Admin dashboard with system-wide metrics
- ✅ User management (view, edit, add notes to volunteer profiles)
- ✅ Shift management (create, edit, delete shifts)
- ✅ Volunteer signup approval and management
- ✅ Group booking approval and oversight
- ✅ Parental consent management for minors
- ✅ System analytics and reporting across all locations
- ✅ Multi-location data filtering and management

## Permission Details

### Dashboard Access
| Feature | Volunteer | Admin |
|---------|-----------|-------|
| Personal dashboard | ✅ | ✅ |
| Admin dashboard | ❌ | ✅ |
| Location filtering | ❌ | ✅ |
| System-wide metrics | ❌ | ✅ |

### User Management  
| Feature | Volunteer | Admin |
|---------|-----------|-------|
| Edit own profile | ✅ | ✅ |
| View other profiles | ❌ | ✅ |
| Edit other profiles | ❌ | ✅ |
| Add admin notes | ❌ | ✅ |
| Parental consent approval | ❌ | ✅ |

### Shift Management
| Feature | Volunteer | Admin |
|---------|-----------|-------|
| View available shifts | ✅ | ✅ |
| Sign up for shifts | ✅ | ✅ |
| Create shifts | ❌ | ✅ |
| Edit/delete shifts | ❌ | ✅ |
| Approve signups | ❌ | ✅ |
| Manage attendance | ❌ | ✅ |

## Authentication & Security

### Session Management
- **Auto-logout**: Sessions expire after 30 days of inactivity
- **Role verification**: Checked on every admin page access
- **Secure redirects**: Unauthorized access redirects to appropriate pages

### Access Control
- **Admin routes** (`/admin/*`) automatically redirect non-admin users
- **API endpoints** verify role permissions before processing requests
- **Navigation elements** dynamically show/hide based on user role

## Role Assignment

### How Users Get Admin Access
1. **Database assignment**: Admins must be designated directly in the database
2. **No self-promotion**: Users cannot upgrade themselves to admin role
3. **Technical requirement**: Requires developer or system administrator access

### Identifying User Roles
**In the Admin Interface:**
- Admin users see role badges in user listings
- User profiles display current role status
- Admin dashboard shows admin-specific navigation

**For Users:**
- Profile pages display current role
- Navigation menus adapt to show available features
- Unauthorized access attempts show appropriate error messages

:::warning[Role Management]
Currently, role changes require direct database access. There is no admin interface for promoting volunteers to admin status. This is by design for security purposes.
:::

## Common Role-Based Scenarios

### Volunteer Scenarios
- **Profile incomplete**: Volunteers see completion reminders and edit links
- **Shift conflicts**: System prevents double-booking on the same day
- **Group bookings**: Can create and manage group invitations
- **Parental consent**: Minors see consent requirements and download links

### Admin Scenarios  
- **Pending approvals**: Dashboard highlights shifts needing attention
- **Multi-location**: Can filter and manage data across all restaurant locations
- **User support**: Can view volunteer profiles to assist with problems
- **System oversight**: Access to analytics and performance metrics

## Next Steps

- Learn about [Navigation Guide](/overview/navigation/) for interface details
- Explore [Viewing Volunteers](/user-management/viewing-volunteers/) for user management
- Check [Admin Permissions](/reference/permissions/) for technical details
