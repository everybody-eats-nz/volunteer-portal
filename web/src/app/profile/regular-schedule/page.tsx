import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  StarIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  SettingsIcon,
  ArrowLeftIcon,
  type LucideIcon,
} from "lucide-react";
import { RegularScheduleManager } from "./regular-schedule-manager";
import { UpcomingRegularShifts } from "./upcoming-regular-shifts";
import { formatInNZT } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { Sparkle } from "@/components/sparkle";

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
        description: "Your regular volunteer status is currently inactive",
      };
    }

    if (regular.isPausedByUser) {
      const until = regular.pausedUntil
        ? ` until ${formatInNZT(regular.pausedUntil, "d MMMM yyyy")}`
        : "";
      return {
        status: "paused",
        label: "Paused",
        description: `Your regular schedule is paused${until}`,
      };
    }

    return {
      status: "active",
      label: "Active",
      description: "Auto-applying to matching shifts",
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
        title={
          <>
            Regular <em>schedule</em>
          </>
        }
        description="Manage your recurring volunteer shift assignments"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/profile">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to profile
            </Link>
          </Button>
        }
      />

      {regularVolunteers.length === 0 ? (
        /* No Regular Status */
        <section className={cn(panel, "px-6 py-12 text-center")}>
          <div className="mx-auto max-w-md">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sun-200/60 text-forest-700 dark:bg-sun-200/15 dark:text-sun-100">
              <StarIcon className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="display display-medium text-2xl tracking-tight text-forest-700 dark:text-cream-50">
              Not a regular volunteer yet
            </h2>
            <p className="mt-3 text-forest-700/75 dark:text-cream-50/75">
              You haven&apos;t been assigned as a regular volunteer. Regular
              volunteers automatically appear as signed up for their assigned
              shifts, making scheduling easier for both you and the admins.
            </p>
            <ul className="mx-auto mt-6 w-fit space-y-2 text-left text-sm text-forest-700/80 dark:text-cream-50/75">
              <li className="flex items-center gap-2">
                <Sparkle className="h-3 w-3 shrink-0 text-forest-500 dark:text-forest-200" />
                Auto-apply to matching shifts
              </li>
              <li className="flex items-center gap-2">
                <Sparkle className="h-3 w-3 shrink-0 text-forest-500 dark:text-forest-200" />
                Set your preferred days and frequency
              </li>
              <li className="flex items-center gap-2">
                <Sparkle className="h-3 w-3 shrink-0 text-forest-500 dark:text-forest-200" />
                Pause any time for holidays or breaks
              </li>
            </ul>
            <p className="mt-6 text-sm text-forest-700/75 dark:text-cream-50/70">
              Contact an administrator if you&apos;d like to become a regular
              volunteer.
            </p>
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          {/* Status Overview */}
          <section className={cn(panel, "p-6")}>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sun-200/60 text-forest-700 dark:bg-sun-200/15 dark:text-sun-100">
                <StarIcon className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-forest-700 dark:text-cream-50">
                  Regular volunteer status
                  <Badge variant="success">{activeCount} active</Badge>
                  {pausedCount > 0 && (
                    <Badge variant="warning">{pausedCount} paused</Badge>
                  )}
                </h2>
                <p className="mt-1 text-sm text-forest-700/75 dark:text-cream-50/70">
                  {regularVolunteers.length === 1
                    ? "You have 1 regular schedule"
                    : `You have ${regularVolunteers.length} regular schedules`}
                </p>
              </div>
            </div>
          </section>

          {/* Individual Schedule Cards */}
          {regularVolunteers.map((regularVolunteer) => {
            const statusInfo = getStatusInfo(regularVolunteer);
            return (
              <section key={regularVolunteer.id} className={cn(panel, "p-6")}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-forest-700 dark:text-cream-50">
                      <CalendarIcon className="h-5 w-5 text-primary-text" aria-hidden />
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
                    </h2>
                    <p className="mt-1 text-sm text-forest-700/75 dark:text-cream-50/70">
                      {statusInfo.description}
                    </p>
                  </div>
                  {statusInfo.status === "active" && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-primary-text">
                        {regularVolunteer.autoSignups.length.toLocaleString("en-NZ")}{" "}
                        auto-signups
                      </div>
                      <div className="text-xs text-forest-700/75 dark:text-cream-50/70">
                        Since {formatInNZT(regularVolunteer.createdAt, "MMMM yyyy")}
                      </div>
                    </div>
                  )}
                </div>

                <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Detail icon={SettingsIcon} label="Shift type">
                    {regularVolunteer.shiftType.name}
                  </Detail>
                  <Detail icon={ClockIcon} label="Frequency">
                    {getFrequencyLabel(regularVolunteer.frequency)}
                  </Detail>
                  <Detail icon={MapPinIcon} label="Location">
                    {regularVolunteer.location}
                  </Detail>
                  <Detail icon={CalendarIcon} label="Available days">
                    {formatDays(regularVolunteer.availableDays)}
                  </Detail>
                </dl>

                {regularVolunteer.volunteerNotes && (
                  <div className="mt-6 rounded-2xl bg-forest-500/5 p-4 dark:bg-cream-50/5">
                    <div className="mb-1 text-sm font-medium text-forest-700 dark:text-cream-50">
                      Your notes
                    </div>
                    <div className="text-sm text-forest-700/80 dark:text-cream-50/75">
                      {regularVolunteer.volunteerNotes}
                    </div>
                  </div>
                )}

                {/* Schedule Management for this schedule */}
                <div className="mt-6 border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
                  <RegularScheduleManager regularVolunteer={regularVolunteer} />
                </div>
              </section>
            );
          })}

          {/* Upcoming Regular Shifts */}
          <UpcomingRegularShifts />
        </div>
      )}
    </PageContainer>
  );
}

/** The cream-paper panel used across the volunteer pages. */
const panel =
  "grain relative overflow-hidden rounded-3xl border border-forest-500/10 bg-card dark:border-cream-50/10";

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <dt className="text-sm font-medium text-forest-700 dark:text-cream-50">
          {label}
        </dt>
        <dd className="text-sm text-forest-700/75 dark:text-cream-50/70">
          {children}
        </dd>
      </div>
    </div>
  );
}
