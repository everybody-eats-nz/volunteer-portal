import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { formatInNZT, toUTC, parseISOInNZT, getDSTTransitionInfo } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isFeatureEnabled } from "@/lib/posthog-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/page-container";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { ShiftLocationSelector } from "@/components/shift-location-selector";
import { ShiftCalendarWrapper } from "@/components/shift-calendar-wrapper";
import { ShiftsByTimeOfDay } from "@/components/shifts-by-time-of-day";
import { LOCATIONS, LocationOption, DEFAULT_LOCATION } from "@/lib/locations";

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
  const selectedLocation = (params.location as LocationOption) || DEFAULT_LOCATION;
  
  // Parse the date string directly in NZ timezone to avoid local time confusion
  const selectedDateNZT = parseISOInNZT(dateString);
  const isToday = dateString === today;
  
  // Check for DST transition issues
  const dstInfo = getDSTTransitionInfo(selectedDateNZT);
  if (dstInfo.nearTransition && process.env.NODE_ENV === 'development') {
    console.warn(`Admin Schedule: ${dstInfo.message}`, { date: dateString, dstInfo });
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
            in: ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING", "NO_SHOW"],
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
                in: ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING", "NO_SHOW"],
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

        {/* Navigation Controls */}
        <div className="mb-6 bg-white dark:bg-black rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col space-y-4 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
              {/* Left Section: Date Navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-200" />
                  </div>
                  <ShiftCalendarWrapper
                    selectedDate={selectedDateNZT}
                    selectedLocation={selectedLocation}
                    shiftSummaries={processedShiftSummaries}
                  />
                </div>

                <div className="hidden sm:block h-12 w-px bg-slate-300 dark:bg-slate-600" />

                {/* Location Selector */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/60 border border-green-300 dark:border-green-700 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-green-700 dark:text-green-200" />
                  </div>
                  <ShiftLocationSelector
                    selectedLocation={selectedLocation}
                    dateString={dateString}
                    locations={LOCATIONS}
                  />
                </div>
              </div>

              {/* Right Section: Quick Actions */}
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  variant={isToday ? "default" : "outline"}
                  size="sm"
                  className={`h-10 ${!isToday ? 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700' : ''}`}
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
          </div>
        </div>

        {/* Shifts Display */}
        {shifts.length === 0 ? (
          <div className="text-center py-12 bg-card dark:bg-card/50 rounded-lg border">
            <div className="h-12 w-12 bg-muted dark:bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              No shifts scheduled
            </h3>
            <p className="text-muted-foreground mb-6">
              Get started by creating your first shift for{" "}
              {formatInNZT(selectedDateNZT, "EEEE, MMMM d, yyyy")} in {selectedLocation}
              .
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
