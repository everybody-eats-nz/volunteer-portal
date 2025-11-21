---
title: Timezone Handling
description: NZT timezone implementation and consistency across the application
---

This application consistently uses **New Zealand Time (Pacific/Auckland)** for all date and time operations. This guide explains how timezone handling works and how to use the timezone utilities correctly.

## Overview

All dates are:
- **Stored in UTC** in the database (PostgreSQL)
- **Displayed in NZ Time** to users (NZST or NZDT depending on DST)
- **Created in NZ Time** when users input dates/times
- **Compared in NZ Time** for scheduling and validation logic

## Timezone Library

We use **@date-fns/tz** (v1.4.1) for timezone handling, which provides:
- Efficient timezone conversions
- DST (Daylight Saving Time) awareness
- Integration with date-fns formatting functions

## Timezone Utilities

All timezone utilities are centralized in `/web/src/lib/timezone.ts`. **Always use these utilities** instead of direct date-fns operations to ensure consistency.

### Core Functions

#### `formatInNZT(date, formatStr)`

Format a date in New Zealand timezone.

```typescript
import { formatInNZT } from "@/lib/timezone";

// Format shift date
const shiftDate = formatInNZT(shift.start, "EEEE, MMMM d, yyyy");
// Output: "Monday, December 25, 2023"

// Format time
const shiftTime = formatInNZT(shift.start, "h:mm a");
// Output: "5:30 PM"

// Format full datetime
const datetime = formatInNZT(shift.start, "yyyy-MM-dd HH:mm:ss");
// Output: "2023-12-25 17:30:00"

// Common format patterns
formatInNZT(date, "yyyy-MM-dd")           // "2023-12-25"
formatInNZT(date, "MMM d, yyyy")          // "Dec 25, 2023"
formatInNZT(date, "EEEE")                 // "Monday"
formatInNZT(date, "h:mm a")               // "5:30 PM"
formatInNZT(date, "HH:mm")                // "17:30"
```

#### `toNZT(date)`

Convert a date to New Zealand timezone (returns TZDate object).

```typescript
import { toNZT } from "@/lib/timezone";

const nzDate = toNZT(new Date());
console.log(nzDate.getHours()); // Hours in NZ timezone

// Use when you need to extract components in NZ time
const year = nzDate.getFullYear();
const month = nzDate.getMonth();
const day = nzDate.getDate();
```

#### `nowInNZT()`

Get the current time in New Zealand.

```typescript
import { nowInNZT } from "@/lib/timezone";

const now = nowInNZT();

// Use for current time comparisons
if (shift.start > now) {
  console.log("Shift is in the future");
}
```

#### `createNZDate(dateString, hour, minute, second)`

Create a date with specific time in NZ timezone. **Use this for shift creation and editing.**

```typescript
import { createNZDate } from "@/lib/timezone";

// Create Nov 9, 2024 at 5:30 PM NZDT
const shiftStart = createNZDate("2024-11-09", 17, 30, 0);

// This works correctly regardless of server timezone
// The returned Date object has the correct UTC timestamp
// representing 5:30 PM in NZ time

// Example: Creating shifts from form data
const [startHour, startMinute] = startTime.split(':').map(Number);
const [endHour, endMinute] = endTime.split(':').map(Number);

const start = createNZDate(date, startHour, startMinute);
const end = createNZDate(date, endHour, endMinute);

// Save to database (automatically stored as UTC)
await prisma.shift.create({
  data: { start, end, ... }
});
```

#### `parseISOInNZT(dateString)`

Parse an ISO date string directly in NZ timezone.

```typescript
import { parseISOInNZT } from "@/lib/timezone";

// Parse URL date parameter
const dateParam = "2024-12-25";
const selectedDate = parseISOInNZT(dateParam);

// This ensures "2024-12-25" represents Dec 25 in NZ,
// not in the server's local timezone
```

#### `isSameDayInNZT(date1, date2)`

Check if two dates are on the same day in NZ timezone.

```typescript
import { isSameDayInNZT } from "@/lib/timezone";

// Check if shift is today
const isToday = isSameDayInNZT(shift.start, new Date());

// Group shifts by day
const shiftsByDay = shifts.reduce((acc, shift) => {
  const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
  if (!acc[dateKey]) acc[dateKey] = [];
  acc[dateKey].push(shift);
  return acc;
}, {});
```

#### `toUTC(tzDate)`

Convert a TZDate to UTC Date object for database queries.

```typescript
import { toUTC, nowInNZT } from "@/lib/timezone";

// Get current time in NZ, then convert to UTC for database query
const now = toUTC(nowInNZT());

const upcomingShifts = await prisma.shift.findMany({
  where: { start: { gte: now } }
});
```

#### `getDSTTransitionInfo(date)`

Check if a date falls within DST transition periods.

```typescript
import { getDSTTransitionInfo } from "@/lib/timezone";

const dstInfo = getDSTTransitionInfo(shiftDate);

if (dstInfo.nearTransition) {
  console.warn(dstInfo.message);
  // "Date is near DST transition - times may be affected"
}

console.log(dstInfo.isDST); // true during NZDT, false during NZST
```

## Common Patterns

### Creating Shifts

```typescript
import { createNZDate } from "@/lib/timezone";

async function createShift(formData) {
  const date = formData.get("date"); // "2024-12-25"
  const startTime = formData.get("startTime"); // "17:30"
  const endTime = formData.get("endTime"); // "20:00"

  // Parse time components
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Create dates in NZ timezone
  const start = createNZDate(date, startHour, startMinute);
  const end = createNZDate(date, endHour, endMinute);

  // Save to database (automatically stored as UTC)
  await prisma.shift.create({
    data: {
      shiftTypeId,
      start,
      end,
      location,
      capacity,
    }
  });
}
```

### Displaying Shift Times

```typescript
import { formatInNZT } from "@/lib/timezone";

function ShiftCard({ shift }) {
  const date = formatInNZT(shift.start, "EEEE, MMMM d, yyyy");
  const time = `${formatInNZT(shift.start, "h:mm a")} - ${formatInNZT(shift.end, "h:mm a")}`;

  return (
    <div>
      <h3>{date}</h3>
      <p>{time}</p>
    </div>
  );
}
```

### Filtering Shifts by Date

```typescript
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { startOfDay, endOfDay } from "date-fns";

async function getShiftsForDate(dateString: string) {
  // Parse the date in NZ timezone
  const selectedDate = parseISOInNZT(dateString);

  // Get start and end of day in NZ timezone
  const dayStart = toUTC(startOfDay(selectedDate));
  const dayEnd = toUTC(endOfDay(selectedDate));

  // Query database (dates are stored in UTC)
  return await prisma.shift.findMany({
    where: {
      start: {
        gte: dayStart,
        lte: dayEnd,
      }
    }
  });
}
```

### Grouping by Date in NZ Time

```typescript
import { formatInNZT } from "@/lib/timezone";

function groupShiftsByDate(shifts) {
  return shifts.reduce((groups, shift) => {
    // Use NZ timezone for date key
    const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(shift);

    return groups;
  }, {});
}
```

### Calendar Integration

```typescript
import { formatInNZT } from "@/lib/timezone";

function generateCalendarEvent(shift) {
  // Format dates in NZ timezone for calendar
  const startDate = formatInNZT(shift.start, "yyyyMMdd'T'HHmmss");
  const endDate = formatInNZT(shift.end, "yyyyMMdd'T'HHmmss");

  // Google Calendar URL
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${startDate}/${endDate}&text=${encodeURIComponent(shift.title)}`;

  return calendarUrl;
}
```

### Checking if Shift is in the Past

```typescript
import { nowInNZT, toUTC } from "@/lib/timezone";

function isShiftPast(shift) {
  const now = toUTC(nowInNZT());
  return shift.end < now;
}

function isShiftUpcoming(shift) {
  const now = toUTC(nowInNZT());
  return shift.start > now;
}
```

## Database Interactions

### Storing Dates

Dates are automatically stored as UTC by Prisma:

```typescript
// ✅ Correct - Create date in NZ timezone, Prisma stores as UTC
const start = createNZDate("2024-12-25", 17, 30, 0);

await prisma.shift.create({
  data: {
    start, // Stored as UTC in database
    end,
  }
});

// ❌ Wrong - Don't use server's local time
const start = new Date("2024-12-25T17:30:00"); // Ambiguous!
```

### Querying Dates

Use UTC timestamps for database queries:

```typescript
import { toUTC, nowInNZT } from "@/lib/timezone";

// ✅ Correct - Convert NZ time to UTC for query
const now = toUTC(nowInNZT());

const upcomingShifts = await prisma.shift.findMany({
  where: { start: { gte: now } }
});

// ❌ Wrong - Don't query with TZDate directly
const now = nowInNZT(); // This is a TZDate
const shifts = await prisma.shift.findMany({
  where: { start: { gte: now } } // May not work as expected
});
```

### Filtering by Date Range

```typescript
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { startOfDay, endOfDay } from "date-fns";

// Get all shifts on Dec 25, 2024 in NZ time
const date = parseISOInNZT("2024-12-25");
const dayStart = toUTC(startOfDay(date));
const dayEnd = toUTC(endOfDay(date));

const shifts = await prisma.shift.findMany({
  where: {
    start: {
      gte: dayStart,
      lte: dayEnd,
    }
  }
});
```

## DST (Daylight Saving Time)

New Zealand observes DST:
- **NZDT (UTC+13)**: Last Sunday in September to first Sunday in April
- **NZST (UTC+12)**: First Sunday in April to last Sunday in September

The timezone utilities automatically handle DST transitions.

### Potential Issues

During DST transitions (2 AM on transition days):
- **Spring forward**: 2:00 AM becomes 3:00 AM (1-hour gap)
- **Fall back**: 3:00 AM becomes 2:00 AM (1-hour overlap)

### Handling DST Transitions

```typescript
import { getDSTTransitionInfo, createNZDate } from "@/lib/timezone";

// Check before creating shifts near DST transitions
const dstInfo = getDSTTransitionInfo(shiftDate);

if (dstInfo.nearTransition) {
  // Show warning to user
  console.warn("Shift is near DST transition. Verify times carefully.");
}

// The createNZDate function handles DST correctly
// Times during the gap (spring forward) will be adjusted
// Times during overlap (fall back) use the first occurrence
```

## Common Mistakes to Avoid

### ❌ Don't Use Server's Local Time

```typescript
// ❌ Wrong - Depends on server timezone
const now = new Date();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

// ✅ Correct - Use NZ timezone utilities
import { nowInNZT, createNZDate, formatInNZT } from "@/lib/timezone";

const now = nowInNZT();
const tomorrowStr = formatInNZT(
  new Date(Date.now() + 24 * 60 * 60 * 1000),
  "yyyy-MM-dd"
);
```

### ❌ Don't Use date-fns Format Directly

```typescript
// ❌ Wrong - Formats in server's timezone
import { format } from "date-fns";
const dateStr = format(shift.start, "MMMM d, yyyy");

// ✅ Correct - Formats in NZ timezone
import { formatInNZT } from "@/lib/timezone";
const dateStr = formatInNZT(shift.start, "MMMM d, yyyy");
```

### ❌ Don't Parse Dates Without Timezone Context

```typescript
// ❌ Wrong - Parses in server's timezone
import { parseISO } from "date-fns";
const date = parseISO("2024-12-25");

// ✅ Correct - Parses in NZ timezone
import { parseISOInNZT } from "@/lib/timezone";
const date = parseISOInNZT("2024-12-25");
```

### ❌ Don't Compare Dates Without Timezone Context

```typescript
// ❌ Wrong - Compares using server's day boundaries
const isToday = shift.start.getDate() === new Date().getDate();

// ✅ Correct - Compares using NZ day boundaries
import { isSameDayInNZT } from "@/lib/timezone";
const isToday = isSameDayInNZT(shift.start, new Date());
```

## Testing with Timezones

When writing tests, be aware of timezone handling:

```typescript
import { createNZDate, formatInNZT } from "@/lib/timezone";

test("should create shift at correct time", async () => {
  // Create shift for Dec 25, 2024 at 5:30 PM NZDT
  const start = createNZDate("2024-12-25", 17, 30, 0);

  // Verify it formats correctly in NZ time
  expect(formatInNZT(start, "yyyy-MM-dd HH:mm")).toBe("2024-12-25 17:30");

  // The UTC timestamp will be different (UTC+13 during NZDT)
  // This is correct - dates are stored as UTC
});
```

## Migration and Data Import

When migrating data or importing from external sources:

```typescript
import { createNZDate } from "@/lib/timezone";

// External data might have date and time as separate strings
const externalShift = {
  date: "2024-11-09",
  startTime: "17:30",
  endTime: "20:00"
};

// Parse and create in NZ timezone
const [startHour, startMinute] = externalShift.startTime.split(':').map(Number);
const [endHour, endMinute] = externalShift.endTime.split(':').map(Number);

const start = createNZDate(externalShift.date, startHour, startMinute, 0);
const end = createNZDate(externalShift.date, endHour, endMinute, 0);

// Now safe to store in database
await prisma.shift.create({ data: { start, end, ... }});
```

## Performance Considerations

The timezone utilities use a **singleton timezone instance** for performance:

```typescript
// lib/timezone.ts
const NZ_TIMEZONE = "Pacific/Auckland";
const nzTimezone = tz(NZ_TIMEZONE); // Created once and reused

// This avoids recreating the timezone object on every call
export function formatInNZT(date: Date | string, formatStr: string): string {
  const nzTime = nzTimezone(dateObj); // Reuses singleton
  return format(nzTime, formatStr, { in: nzTimezone });
}
```

This optimization is especially important for:
- Lists with many dates (shift calendars, tables)
- Real-time updates
- Server-side rendering with many concurrent requests

## Summary

**Always use the timezone utilities** from `/web/src/lib/timezone.ts`:

| Task | Function | Example |
|------|----------|---------|
| Display date/time | `formatInNZT()` | `formatInNZT(date, "MMM d, yyyy")` |
| Create shift datetime | `createNZDate()` | `createNZDate("2024-12-25", 17, 30)` |
| Parse URL date param | `parseISOInNZT()` | `parseISOInNZT("2024-12-25")` |
| Get current time | `nowInNZT()` | `const now = nowInNZT()` |
| Compare dates | `isSameDayInNZT()` | `isSameDayInNZT(date1, date2)` |
| Database queries | `toUTC()` | `toUTC(nowInNZT())` |
| Check DST | `getDSTTransitionInfo()` | `getDSTTransitionInfo(date)` |

**Key Principles:**
1. Store dates in UTC (automatic with Prisma)
2. Display dates in NZ time (use `formatInNZT`)
3. Create dates in NZ time (use `createNZDate`)
4. Compare dates in NZ time (use `isSameDayInNZT`)
5. Convert to UTC for database queries (use `toUTC`)

Following these patterns ensures consistent timezone handling across the entire application.