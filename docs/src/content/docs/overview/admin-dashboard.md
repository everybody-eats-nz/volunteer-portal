---
title: Admin Dashboard Overview
description: Learn to navigate the admin dashboard and understand key metrics for managing volunteers and shifts
---

The Admin Dashboard is your central command center for managing the volunteer portal. It provides real-time insights into volunteer activity, shift scheduling, and system performance across all locations.

## Dashboard Layout

### Statistics Overview
The dashboard displays four key metric cards:

1. **Total Users** - Shows volunteer count vs. admin count
2. **Total Shifts** - Displays upcoming vs. completed shifts  
3. **Total Signups** - Tracks confirmed, pending, and waitlisted signups
4. **This Month** - Highlights current month activity and new user registrations

:::tip[Reading the Metrics]
Numbers update in real-time based on your current location filter. Use the location tabs to view location-specific statistics.
:::

### Location Filtering
Filter all dashboard data by location using the tabs:
- **All** - Shows combined data from all locations
- **Wellington** - Wellington restaurant data only
- **Glen Innes** - Glen Innes restaurant data only  
- **Onehunga** - Onehunga restaurant data only

The URL updates automatically to preserve your filter selection: `/admin?location=Wellington`

## Key Sections

### Next Shift Information
Displays the next upcoming shift with:
- 🔵 Shift date and time
- 🟢 Current volunteer count vs. capacity  
- 🔵 Location details
- Quick link to view full shift details

### Needs Attention
Highlights shifts requiring immediate attention:
- 🔴 **Low signup rates** (less than 25% capacity)
- 🟡 **Moderate concern** (25-50% capacity)
- 🟢 **Good signup rates** (75%+ capacity)

### Recent Signups
Shows the latest volunteer activity with status badges:
- 🟢 **Confirmed** - Approved signups
- 🟡 **Pending** - Awaiting admin approval
- 🔵 **Waitlisted** - On waiting list for full shifts
- 🔴 **Canceled** - Canceled signups

### Quick Actions
Direct links to common administrative tasks:
- **Create New Shift** - Opens the shift creation form
- **Manage All Shifts** - Navigate to shift management calendar
- **Manage Users** - Access user management interface
- **View Public Shifts** - See the volunteer-facing shifts page

## Navigation Tips

1. **Use location filtering** to focus on specific restaurant data
2. **Monitor pending signups** for shifts requiring approval
3. **Check "Needs Attention"** daily for understaffed shifts
4. **Quick Actions** provide shortcuts to common tasks

:::note[Dashboard Updates]
Dashboard metrics refresh automatically every 30 seconds. Manual refresh using your browser will also update all statistics.
:::

## Next Steps

- Learn about [User Roles & Permissions](/overview/user-roles/)
- Explore [Navigation Guide](/overview/navigation/) for detailed interface walkthrough
- Start managing volunteers with [Viewing Volunteers](/user-management/viewing-volunteers/)
