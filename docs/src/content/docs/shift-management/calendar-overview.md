---
title: Calendar Overview
description: Master the shift management calendar for scheduling volunteers and monitoring capacity across all locations
---

The shift management calendar is your primary tool for scheduling volunteers and monitoring shift capacity across all restaurant locations.

## Calendar Interface

### Date Navigation
- **Calendar Picker**: Click the date button (showing current month/year) to open calendar popup
- **Location Selector**: Filter shifts by specific restaurant location
- **Today Button**: Quick return to current date
- **Legend**: Color-coded staffing levels visible in calendar popup

:::note[Navigation Change]
The calendar now uses a date picker instead of previous/next month buttons for more efficient navigation to any date.
:::

### Staffing Level Indicators
The calendar uses color coding to show shift capacity:

- <span class="status-dot green"></span> **Fully Staffed (100%+)** - Green background
- <span class="status-dot yellow"></span> **Moderate Staffing (25-75%)** - Yellow background  
- <span class="status-dot red"></span> **Critical Staffing (<25%)** - Red background
- **No color** - No shifts scheduled for that date

## Calendar Features

### Location-Based Filtering
Use the location selector to focus on specific restaurants:
- **All Locations** - Combined view of all restaurant shifts
- **Wellington** - Wellington location shifts only
- **Glen Innes** - Glen Innes location shifts only
- **Onehunga** - Onehunga location shifts only

URL automatically updates: `/admin/shifts?location=Wellington`

### Shift Information Display
Each calendar date shows:
- **Shift count** for that date
- **Staffing percentage** via color coding
- **Critical alerts** for understaffed shifts

### Quick Actions
- **Create Shift Button** - Opens shift creation form
- **Calendar Legend** - Shows staffing level meanings
- **Date Selection** - Click any date to view detailed shift information

## Working with Shifts

### Creating Shifts
1. Click **"Create Shift"** button in top navigation
2. Select date, time, location, and capacity
3. Set shift type (Kitchen, Service, Cleaning, etc.)
4. Define any special requirements or notes
5. Save to make available for volunteer signups

### Managing Existing Shifts  
1. Click on any date in the calendar
2. View list of shifts for that date
3. Click individual shifts to:
   - Edit shift details
   - Manage volunteer signups
   - View capacity and waitlists
   - Track attendance

### Monitoring Capacity
**Daily Overview:**
- Red dates indicate shifts needing immediate attention
- Yellow dates show moderate staffing concerns
- Green dates are fully staffed or overstaffed

**Detailed View:**
- Click dates to see specific volunteer assignments
- Review pending signup approvals
- Manage waitlisted volunteers

## Shift Status Management

### Approval Workflow
1. **Pending Signups** - Volunteers request shift assignments
2. **Admin Review** - Admins approve or deny requests
3. **Confirmed Signups** - Approved volunteers receive confirmation
4. **Waitlist Management** - Handle excess signups for popular shifts

### Group Bookings
- **Group Requests** - Multiple volunteers booking together
- **Invitation Status** - Track group member responses
- **Approval Requirements** - All group members must complete profiles
- **Capacity Management** - Ensure group size fits shift capacity

## Best Practices

### Daily Monitoring
- Check **red/critical dates** first each day
- Review **pending approvals** regularly
- Monitor **upcoming shifts** (next 7 days) for capacity issues

### Shift Planning
- Create shifts **2-4 weeks in advance** for better volunteer planning
- Consider **recurring shifts** for regular restaurant operations
- Account for **holiday schedules** and special events

### Volunteer Communication
- **Early approval** of signups helps volunteers plan
- **Waitlist communication** keeps volunteers engaged
- **Capacity updates** help volunteers understand availability

:::tip[Efficiency Tips]
- Use location filtering to focus on specific restaurant needs
- Check the Needs Attention section on the dashboard for urgent capacity issues
- Create shifts in batches for consistent scheduling
:::

## Common Scenarios

### Understaffed Shifts
1. Calendar shows **red background** for critical dates
2. Dashboard "Needs Attention" highlights the issue  
3. Consider:
   - Sending targeted emails to eligible volunteers
   - Adjusting shift requirements or capacity
   - Creating incentives for hard-to-fill shifts

### Overstaffed Shifts
1. **Green background** indicates full capacity
2. **Waitlist management** for excess volunteers
3. Options:
   - Create additional shifts if demand supports it
   - Maintain waitlist for last-minute cancellations
   - Thank volunteers and suggest alternative dates

### Group Booking Requests
1. **Review group composition** and leader credentials
2. **Check all member profiles** for completion
3. **Verify capacity** fits group size
4. **Approve or request modifications** as needed

## Next Steps

- Learn [Creating Shifts](/shift-management/creating-shifts/) for detailed shift setup
- Explore [Managing Signups](/shift-management/managing-signups/) for approval workflows  
- Review [Group Bookings](/shift-management/group-bookings/) for group management
