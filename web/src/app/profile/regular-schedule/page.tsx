import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  StarIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  SettingsIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { RegularScheduleManager } from "./regular-schedule-manager";
import { UpcomingRegularShifts } from "./upcoming-regular-shifts";
import { format } from "date-fns";

export default async function RegularSchedulePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile/regular-schedule");
  }

  // Get user's regular volunteer records (one per shift type)
  const regularVolunteers = await prisma.regularVolunteer.findMany({
    where: { userId: session.user.id },
    include: {
      shiftType: true,
      autoSignups: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          signup: {
            include: {
              shift: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  type RegularVolunteerType = (typeof regularVolunteers)[0];

  const getStatusInfo = (regular: RegularVolunteerType) => {
    if (!regular.isActive) {
      return {
        status: "inactive",
        label: "Inactive",
        description: "Regular volunteer status is currently inactive",
        color: "text-gray-500",
        bgColor: "bg-gray-100",
      };
    }

    if (regular.isPausedByUser) {
      const until = regular.pausedUntil
        ? ` until ${format(regular.pausedUntil, "MMM d, yyyy")}`
        : "";
      return {
        status: "paused",
        label: "Paused",
        description: `Regular schedule is paused${until}`,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
      };
    }

    return {
      status: "active",
      label: "Active",
      description: "Auto-applying to matching shifts",
      color: "text-green-600",
      bgColor: "bg-green-50",
    };
  };

  // Calculate overall status summary
  const activeCount = regularVolunteers.filter(
    (r) => r.isActive && !r.isPausedByUser
  ).length;
  const pausedCount = regularVolunteers.filter((r) => r.isPausedByUser).length;

  const formatDays = (days: string[]) => {
    const shortDays = days.map((day) => day.substring(0, 3));
    if (shortDays.length === 7) return "Every day";
    if (
      shortDays.length === 5 &&
      !days.includes("Saturday") &&
      !days.includes("Sunday")
    ) {
      return "Weekdays";
    }
    if (
      shortDays.length === 2 &&
      days.includes("Saturday") &&
      days.includes("Sunday")
    ) {
      return "Weekends";
    }
    return shortDays.join(", ");
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case "WEEKLY":
        return "Weekly";
      case "FORTNIGHTLY":
        return "Fortnightly";
      case "MONTHLY":
        return "Monthly";
      default:
        return frequency;
    }
  };

  return (
    <PageContainer testid="regular-schedule-page">
      <PageHeader
        title="Regular Schedule"
        description="Manage your recurring volunteer shift assignments"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/profile">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Profile
            </Link>
          </Button>
        }
      />

      {regularVolunteers.length === 0 ? (
        /* No Regular Status */
        <Card className="text-center py-12">
          <CardContent>
            <div className="max-w-md mx-auto">
              <StarIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-xl font-semibold mb-2">
                Not a Regular Volunteer Yet
              </h2>
              <p className="text-muted-foreground mb-6">
                You haven&apos;t been assigned as a regular volunteer. Regular
                volunteers automatically appear as signed up for their assigned
                shifts, making scheduling easier for both you and the admins.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Auto-apply to matching shifts</p>
                <p>• Set your preferred days and frequency</p>
                <p>• Pause anytime for vacations or breaks</p>
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                Contact an administrator if you&apos;d like to become a regular
                volunteer.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-yellow-50">
                    <StarIcon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Regular Volunteer Status
                      <Badge variant="success">{activeCount} Active</Badge>
                      {pausedCount > 0 && (
                        <Badge variant="warning">{pausedCount} Paused</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {regularVolunteers.length === 1
                        ? "You have 1 regular schedule"
                        : `You have ${regularVolunteers.length} regular schedules`}
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Individual Schedule Cards */}
          {regularVolunteers.map((regularVolunteer) => {
            const statusInfo = getStatusInfo(regularVolunteer);
            return (
              <Card key={regularVolunteer.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      {regularVolunteer.shiftType.name}
                      <Badge
                        variant={
                          statusInfo.status === "active"
                            ? "success"
                            : statusInfo.status === "paused"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {statusInfo.label}
                      </Badge>
                    </CardTitle>
                    {statusInfo.status === "active" && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          {regularVolunteer.autoSignups.length} auto-signups
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Since {format(regularVolunteer.createdAt, "MMM yyyy")}
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <SettingsIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">Shift Type</div>
                          <div className="text-sm text-muted-foreground">
                            {regularVolunteer.shiftType.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <MapPinIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">Location</div>
                          <div className="text-sm text-muted-foreground">
                            {regularVolunteer.location}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 rounded-lg">
                          <ClockIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium">Frequency</div>
                          <div className="text-sm text-muted-foreground">
                            {getFrequencyLabel(regularVolunteer.frequency)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg">
                          <CalendarIcon className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium">Available Days</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDays(regularVolunteer.availableDays)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {regularVolunteer.volunteerNotes && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <div className="font-medium mb-2">Your Notes</div>
                      <div className="text-sm text-muted-foreground">
                        {regularVolunteer.volunteerNotes}
                      </div>
                    </div>
                  )}

                  {/* Schedule Management for this schedule */}
                  <div className="mt-6 pt-6 border-t">
                    <RegularScheduleManager regularVolunteer={regularVolunteer} />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Upcoming Regular Shifts */}
          <UpcomingRegularShifts />
        </div>
      )}
    </PageContainer>
  );
}
