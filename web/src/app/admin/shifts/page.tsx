import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import {
  formatInNZT,
  toUTC,
  parseISOInNZT,
  getDSTTransitionInfo,
} from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/page-container";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { ShiftLocationSelector } from "@/components/shift-location-selector";
import { ShiftCalendarWrapper } from "@/components/shift-calendar-wrapper";
import { ShiftsByTimeOfDay } from "@/components/shifts-by-time-of-day";
import { LocationOption, DEFAULT_LOCATION, LOCATIONS } from "@/lib/locations";
import { MealsServedInput } from "@/components/meals-served-input";

interface AdminShiftsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminShiftsPage({
  searchParams,
}: AdminShiftsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Parse search parameters (handle dates consistently in NZ timezone)
  const today = formatInNZT(new Date(), "yyyy-MM-dd");
  const dateString = (params.date as string) || today;
  const selectedLocation =
    (params.location as LocationOption) || DEFAULT_LOCATION;

  // Parse the date string directly in NZ timezone to avoid local time confusion
  const selectedDateNZT = parseISOInNZT(dateString);
  const isToday = dateString === today;

  // Check for DST transition issues
  const dstInfo = getDSTTransitionInfo(selectedDateNZT);
  if (dstInfo.nearTransition && process.env.NODE_ENV === "development") {
    console.warn(`Admin Schedule: ${dstInfo.message}`, {
      date: dateString,
      dstInfo,
    });
  }

  // Fetch shifts for the selected date and location (using NZ timezone)
  // Calculate day boundaries in NZ timezone - selectedDateNZT is already in NZT
  const startOfDayNZ = startOfDay(selectedDateNZT);
  const endOfDayNZ = endOfDay(selectedDateNZT);

  // Convert TZDate objects to explicit UTC for reliable Prisma queries
  const startOfDayUTC = toUTC(startOfDayNZ);
  const endOfDayUTC = toUTC(endOfDayNZ);

  const allShifts = await prisma.shift.findMany({
    where: {
      location: selectedLocation,
      start: {
        gte: startOfDayUTC,
        lte: endOfDayUTC,
      },
    },
    include: {
      shiftType: true,
      signups: {
        where: {
          status: {
            in: [
              "CONFIRMED",
              "PENDING",
              "WAITLISTED",
              "REGULAR_PENDING",
              "NO_SHOW",
            ],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              volunteerGrade: true,
              profilePhotoUrl: true,
              dateOfBirth: true,
              adminNotes: {
                where: {
                  isArchived: false,
                },
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  creator: {
                    select: {
                      name: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: 1,
              },
              customLabels: {
                include: {
                  label: true,
                },
                orderBy: {
                  assignedAt: "desc",
                },
              },
            },
          },
        },
      },
      groupBookings: {
        include: {
          signups: {
            where: {
              status: {
                in: [
                  "CONFIRMED",
                  "PENDING",
                  "WAITLISTED",
                  "REGULAR_PENDING",
                  "NO_SHOW",
                ],
              },
            },
          },
        },
      },
      _count: {
        select: {
          signups: {
            where: {
              status: "CONFIRMED",
            },
          },
        },
      },
    },
    orderBy: {
      start: "asc",
    },
  });

  const shifts = allShifts;

  // Get shift data for the calendar with location, capacity, and confirmed counts
  // Include past shifts for attendance tracking - show last 30 days + future shifts
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const allCalendarShifts = await prisma.shift.findMany({
    where: {
      start: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      start: true,
      location: true,
      capacity: true,
      shiftType: {
        select: {
          name: true,
        },
      },
      signups: {
        where: {
          status: "CONFIRMED",
        },
        select: {
          id: true,
        },
      },
    },
  });

  const calendarShifts = allCalendarShifts;

  // Process shifts into calendar-friendly format
  const shiftSummariesMap = new Map<
    string,
    {
      count: number;
      totalCapacity: number;
      totalConfirmed: number;
      locations: string[];
    }
  >();

  calendarShifts.forEach((shift) => {
    const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
    const location = shift.location || "Unknown";

    if (!shiftSummariesMap.has(dateKey)) {
      shiftSummariesMap.set(dateKey, {
        count: 0,
        totalCapacity: 0,
        totalConfirmed: 0,
        locations: [],
      });
    }

    const summary = shiftSummariesMap.get(dateKey)!;
    summary.count++;
    summary.totalCapacity += shift.capacity;
    summary.totalConfirmed += shift.signups.length;

    if (!summary.locations.includes(location)) {
      summary.locations.push(location);
    }
  });

  const processedShiftSummaries = Array.from(shiftSummariesMap.entries()).map(
    ([date, data]) => ({
      date,
      ...data,
    })
  );

  return (
    <AdminPageWrapper
      title="Restaurant Schedule"
      actions={
        <Button asChild size="sm" data-testid="create-shift-button">
          <Link href="/admin/shifts/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Shift
          </Link>
        </Button>
      }
    >
      <PageContainer>
        {/* Success Messages */}
        {params.created && (
          <Alert className="mb-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <AlertDescription
              data-testid="shift-created-message"
              className="text-green-800 dark:text-green-200"
            >
              Shift created successfully!
            </AlertDescription>
          </Alert>
        )}
        {params.updated && (
          <Alert className="mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <AlertDescription
              data-testid="shift-updated-message"
              className="text-blue-800 dark:text-blue-200"
            >
              Shift updated successfully!
            </AlertDescription>
          </Alert>
        )}
        {params.deleted && (
          <Alert className="mb-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <AlertDescription
              data-testid="shift-deleted-message"
              className="text-red-800 dark:text-red-200"
            >
              Shift deleted successfully!
            </AlertDescription>
          </Alert>
        )}

        {/* Modern Toolbar */}
        <div className="mb-8 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Filters - Clean, minimal design */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <ShiftCalendarWrapper
              selectedDate={selectedDateNZT}
              selectedLocation={selectedLocation}
              shiftSummaries={processedShiftSummaries}
            />
            <ShiftLocationSelector
              selectedLocation={selectedLocation}
              dateString={dateString}
              locations={LOCATIONS}
            />
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 w-full lg:w-auto">
            <Button
              asChild
              variant={isToday ? "default" : "outline"}
              size="sm"
              className={`flex-1 lg:flex-none h-11 ${
                !isToday
                  ? "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                  : ""
              }`}
              data-testid="today-button"
            >
              <Link
                href={`/admin/shifts?date=${today}&location=${selectedLocation}`}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Link>
            </Button>
          </div>
        </div>

        {/* Meals Served Input - Only show if shifts exist for this day */}
        {shifts.length > 0 && (
          <MealsServedInput date={dateString} location={selectedLocation} />
        )}

        {/* Shifts Display */}
        {shifts.length === 0 ? (
          <div className="text-center py-12 bg-card dark:bg-card/50 rounded-lg border">
            <div className="h-12 w-12 bg-muted dark:bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No shifts scheduled</h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first shift for{" "}
              {formatInNZT(selectedDateNZT, "EEEE, MMMM d, yyyy")} in{" "}
              {selectedLocation}.
            </p>
            <Button asChild size="sm" className="btn-primary">
              <Link href="/admin/shifts/new">
                <Plus className="h-4 w-4 mr-1.5" />
                Create First Shift
              </Link>
            </Button>
          </div>
        ) : (
          <ShiftsByTimeOfDay shifts={shifts} />
        )}
      </PageContainer>
    </AdminPageWrapper>
  );
}
