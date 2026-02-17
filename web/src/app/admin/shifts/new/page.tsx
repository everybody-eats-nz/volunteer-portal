import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { PlusIcon, CalendarDaysIcon, RefreshCwIcon } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { BulkDateRangeSection } from "@/components/shift-date-time-section";
import { ShiftCreationClientForm } from "@/components/shift-creation-client-form";
import { CollapsibleTemplateSelection } from "@/components/collapsible-template-selection";
import {
  formatInNZT,
  createNZDate,
  parseISOInNZT,
  nowInNZT,
  toUTC,
} from "@/lib/timezone";
import { DeleteTemplateForm } from "@/components/delete-template-form";
import { CreateTemplateDialog } from "@/components/create-template-dialog";
import { EditTemplateDialog } from "@/components/edit-template-dialog";
import { LOCATIONS } from "@/lib/locations";
import { createShiftRecord } from "@/lib/services/shift-service";

// Templates are now stored in the database and fetched dynamically

export default async function NewShiftPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const sortedLocations = LOCATIONS;
  if (!session?.user) redirect("/login?callbackUrl=/admin/shifts/new");
  if (role !== "ADMIN") redirect("/shifts");

  async function createShift(formData: FormData) {
    "use server";

    const schema = z.object({
      shiftTypeId: z.string().cuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      location: z.string().min(1),
      capacity: z.coerce.number().int().min(1).max(1000),
      notes: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    });

    const parsed = schema.safeParse({
      shiftTypeId: formData.get("shiftTypeId"),
      date: formData.get("date"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      location: formData.get("location"),
      capacity: formData.get("capacity"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      redirect("/admin/shifts/new?error=validation");
    }

    const { shiftTypeId, date, startTime, endTime, location, capacity, notes } =
      parsed.data;

    // Parse time components and create dates in NZ timezone
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const start = createNZDate(date, startHour, startMinute);
    const end = createNZDate(date, endHour, endMinute);

    if (!(start instanceof Date) || isNaN(start.getTime()))
      redirect("/admin/shifts/new?error=startdate");
    if (!(end instanceof Date) || isNaN(end.getTime()))
      redirect("/admin/shifts/new?error=enddate");
    if (end <= start) redirect("/admin/shifts/new?error=range");

    // Use NZ timezone for "now" to ensure consistent validation
    const now = toUTC(nowInNZT());
    if (start <= now) redirect("/admin/shifts/new?error=past");

    try {
      // Create the shift
      const shift = await createShiftRecord({
        shiftTypeId,
        start,
        end,
        location,
        capacity,
        notes: notes ?? null,
      });

      // Find matching regular volunteers (use NZ timezone for day calculation)
      const dayOfWeek = formatInNZT(start, "EEEE");
      const regularVolunteers = await prisma.regularVolunteer.findMany({
        where: {
          shiftTypeId,
          ...(location && { location }),
          isActive: true,
          isPausedByUser: false,
          availableDays: {
            has: dayOfWeek,
          },
        },
      });

      // Filter by frequency
      const matchingRegulars = regularVolunteers.filter((regular) => {
        if (regular.frequency === "WEEKLY") {
          return true;
        } else if (regular.frequency === "FORTNIGHTLY") {
          const weeksSinceCreation = Math.floor(
            (start.getTime() - regular.createdAt.getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );
          return weeksSinceCreation % 2 === 0;
        } else if (regular.frequency === "MONTHLY") {
          // Check if this is the first occurrence of this day in the month
          const firstOccurrenceInMonth = new Date(
            start.getFullYear(),
            start.getMonth(),
            1
          );
          while (firstOccurrenceInMonth.getDay() !== start.getDay()) {
            firstOccurrenceInMonth.setDate(
              firstOccurrenceInMonth.getDate() + 1
            );
          }
          return start.getDate() === firstOccurrenceInMonth.getDate();
        }
        return false;
      });

      // Create auto-signups for matching regular volunteers
      if (matchingRegulars.length > 0) {
        const shiftDay = new Date(start);
        shiftDay.setHours(0, 0, 0, 0);
        const nextDay = new Date(shiftDay);
        nextDay.setDate(nextDay.getDate() + 1);

        // OPTIMIZED: Batch query all existing signups at once
        const volunteerIds = matchingRegulars.map((r) => r.userId);
        const existingSignups = await prisma.signup.findMany({
          where: {
            userId: { in: volunteerIds },
            shift: {
              start: {
                gte: shiftDay,
                lt: nextDay,
              },
            },
            status: {
              in: ["CONFIRMED", "REGULAR_PENDING", "PENDING"],
            },
          },
          select: {
            userId: true,
          },
        });

        // Build a set of user IDs who already have signups
        const existingUserIds = new Set(existingSignups.map((s) => s.userId));

        const signups = [];
        const regularSignups = [];

        for (const regular of matchingRegulars) {
          if (!existingUserIds.has(regular.userId)) {
            const signupId = crypto.randomUUID();
            signups.push({
              id: signupId,
              userId: regular.userId,
              shiftId: shift.id,
              status: "REGULAR_PENDING" as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            regularSignups.push({
              regularVolunteerId: regular.id,
              signupId: signupId,
            });
          }
        }

        if (signups.length > 0) {
          await prisma.signup.createMany({ data: signups });
          await prisma.regularSignup.createMany({ data: regularSignups });
        }
      }
    } catch {
      redirect("/admin/shifts/new?error=create");
    }

    redirect("/admin/shifts?created=1");
  }

  async function createBulkShifts(formData: FormData) {
    "use server";

    const schema = z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      selectedDays: z.array(z.string()).min(1, "Select at least one day"),
      selectedTemplates: z
        .array(z.string())
        .min(1, "Select at least one template"),
    });

    // Parse selected days and templates from FormData
    const formSelectedDays: string[] = [];
    const formSelectedTemplates: string[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("day_") && value === "on") {
        formSelectedDays.push(key.replace("day_", ""));
      }
      if (key.startsWith("template_") && value === "on") {
        formSelectedTemplates.push(key.replace("template_", ""));
      }
    }

    const parsed = schema.safeParse({
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      selectedDays: formSelectedDays,
      selectedTemplates: formSelectedTemplates,
    });

    if (!parsed.success) {
      console.error("Validation errors:", parsed.error.format());
      redirect("/admin/shifts/new?error=bulk_validation");
    }

    const { startDate, endDate, selectedDays, selectedTemplates } = parsed.data;

    // Parse dates in NZ timezone to ensure correct day-of-week calculations
    const start = parseISOInNZT(startDate);
    const end = parseISOInNZT(endDate);

    if (end < start) {
      redirect("/admin/shifts/new?error=date_range");
    }

    // Fetch templates from database
    const dbTemplates = await prisma.shiftTemplate.findMany({
      where: {
        isActive: true,
        name: { in: selectedTemplates },
      },
    });

    // Convert database templates to lookup object
    const templatesWithShiftTypes = Object.fromEntries(
      dbTemplates.map((template) => [
        template.name,
        {
          name: template.name,
          startTime: template.startTime,
          endTime: template.endTime,
          capacity: template.capacity,
          notes: template.notes || "",
          shiftTypeId: template.shiftTypeId,
          location: template.location || undefined,
        },
      ])
    );

    const shifts = [];
    // Iterate through date range in NZ timezone
    let current = new Date(start.getTime());
    const now = toUTC(nowInNZT());

    while (current <= end) {
      // Get day name in NZ timezone
      const dayName = formatInNZT(current, "EEEE");

      if (selectedDays.includes(dayName)) {
        for (const templateName of selectedTemplates) {
          const template = templatesWithShiftTypes[templateName];
          if (template) {
            // Parse time components and create dates in NZ timezone
            const dateStr = formatInNZT(current, "yyyy-MM-dd");
            const [startHour, startMinute] = template.startTime
              .split(":")
              .map(Number);
            const [endHour, endMinute] = template.endTime
              .split(":")
              .map(Number);
            const shiftStart = createNZDate(dateStr, startHour, startMinute);
            const shiftEnd = createNZDate(dateStr, endHour, endMinute);

            // Only create future shifts (compare in NZ timezone)
            if (shiftStart > now) {
              shifts.push({
                shiftTypeId: template.shiftTypeId,
                start: shiftStart,
                end: shiftEnd,
                location: template.location || "General",
                capacity: template.capacity,
                notes: template.notes,
              });
            }
          }
        }
      }

      // Increment by one day
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    if (shifts.length === 0) {
      redirect("/admin/shifts/new?error=no_shifts");
    }

    try {
      // Create all shifts
      await prisma.shift.createMany({
        data: shifts,
      });

      // Get the created shifts
      const createdShifts = await prisma.shift.findMany({
        where: {
          start: {
            gte: shifts[0].start,
            lte: shifts[shifts.length - 1].start,
          },
          shiftTypeId: {
            in: shifts.map((s) => s.shiftTypeId),
          },
        },
      });

      // OPTIMIZED: Batch process regular volunteers for all shifts

      // Step 1: Get unique combinations of (shiftTypeId, location, dayOfWeek)
      const shiftConfigs = new Map<string, Set<string>>();
      for (const shift of createdShifts) {
        const dayOfWeek = formatInNZT(shift.start, "EEEE");
        const key = `${shift.shiftTypeId}|${shift.location || ""}`;
        if (!shiftConfigs.has(key)) {
          shiftConfigs.set(key, new Set());
        }
        shiftConfigs.get(key)!.add(dayOfWeek);
      }

      // Step 2: Query all regular volunteers at once (batch by config)
      const allRegularVolunteers = await Promise.all(
        Array.from(shiftConfigs.entries()).map(([key, days]) => {
          const [shiftTypeId, location] = key.split("|");
          return prisma.regularVolunteer.findMany({
            where: {
              shiftTypeId,
              ...(location && { location }),
              isActive: true,
              isPausedByUser: false,
              availableDays: {
                hasSome: Array.from(days),
              },
            },
          });
        })
      );

      const regularVolunteers = allRegularVolunteers.flat();

      // Step 3: Get all unique volunteer IDs
      const volunteerIds = [...new Set(regularVolunteers.map((r) => r.userId))];

      // Step 4: Get all unique dates to check for existing signups
      const shiftDates = createdShifts.map((shift) => {
        const shiftDay = new Date(shift.start);
        shiftDay.setHours(0, 0, 0, 0);
        return shiftDay.getTime();
      });
      const uniqueDates = [...new Set(shiftDates)].sort();

      // Step 5: Query all existing signups at once
      const existingSignups = await prisma.signup.findMany({
        where: {
          userId: { in: volunteerIds },
          shift: {
            start: {
              gte: new Date(uniqueDates[0]),
              lt: new Date(uniqueDates[uniqueDates.length - 1] + 24 * 60 * 60 * 1000),
            },
          },
          status: {
            in: ["CONFIRMED", "REGULAR_PENDING", "PENDING"],
          },
        },
        select: {
          userId: true,
          shift: {
            select: {
              start: true,
            },
          },
        },
      });

      // Step 6: Build lookup map for existing signups (userId -> Set of dates)
      const existingSignupMap = new Map<string, Set<string>>();
      for (const signup of existingSignups) {
        const date = new Date(signup.shift.start);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString().split("T")[0];

        if (!existingSignupMap.has(signup.userId)) {
          existingSignupMap.set(signup.userId, new Set());
        }
        existingSignupMap.get(signup.userId)!.add(dateKey);
      }

      // Step 7: Build regular volunteer lookup by (shiftTypeId, location, dayOfWeek)
      const regularsByConfig = new Map<string, typeof regularVolunteers>();
      for (const regular of regularVolunteers) {
        for (const day of regular.availableDays) {
          const key = `${regular.shiftTypeId}|${regular.location || ""}|${day}`;
          if (!regularsByConfig.has(key)) {
            regularsByConfig.set(key, []);
          }
          regularsByConfig.get(key)!.push(regular);
        }
      }

      // Step 8: Process all shifts and build signup batches
      const allSignups: Array<{
        id: string;
        userId: string;
        shiftId: string;
        status: "REGULAR_PENDING";
        createdAt: Date;
        updatedAt: Date;
      }> = [];
      const allRegularSignups: Array<{
        regularVolunteerId: string;
        signupId: string;
      }> = [];

      for (const shift of createdShifts) {
        const dayOfWeek = formatInNZT(shift.start, "EEEE");
        const shiftDate = new Date(shift.start);
        shiftDate.setHours(0, 0, 0, 0);
        const dateKey = shiftDate.toISOString().split("T")[0];

        const key = `${shift.shiftTypeId}|${shift.location || ""}|${dayOfWeek}`;
        const matchingVolunteers = regularsByConfig.get(key) || [];

        // Filter by frequency
        const matchingRegulars = matchingVolunteers.filter((regular) => {
          if (regular.frequency === "WEEKLY") {
            return true;
          } else if (regular.frequency === "FORTNIGHTLY") {
            const weeksSinceCreation = Math.floor(
              (shift.start.getTime() - regular.createdAt.getTime()) /
                (7 * 24 * 60 * 60 * 1000)
            );
            return weeksSinceCreation % 2 === 0;
          } else if (regular.frequency === "MONTHLY") {
            const firstOccurrenceInMonth = new Date(
              shift.start.getFullYear(),
              shift.start.getMonth(),
              1
            );
            while (firstOccurrenceInMonth.getDay() !== shift.start.getDay()) {
              firstOccurrenceInMonth.setDate(
                firstOccurrenceInMonth.getDate() + 1
              );
            }
            return shift.start.getDate() === firstOccurrenceInMonth.getDate();
          }
          return false;
        });

        // Check for existing signups and create new ones
        for (const regular of matchingRegulars) {
          const hasExistingSignup = existingSignupMap.get(regular.userId)?.has(dateKey);

          if (!hasExistingSignup) {
            const signupId = crypto.randomUUID();
            allSignups.push({
              id: signupId,
              userId: regular.userId,
              shiftId: shift.id,
              status: "REGULAR_PENDING" as const,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            allRegularSignups.push({
              regularVolunteerId: regular.id,
              signupId: signupId,
            });
          }
        }
      }

      // Step 9: Create all signups in batches (avoid hitting query limits)
      const BATCH_SIZE = 500;
      for (let i = 0; i < allSignups.length; i += BATCH_SIZE) {
        const signupBatch = allSignups.slice(i, i + BATCH_SIZE);
        const regularSignupBatch = allRegularSignups.slice(i, i + BATCH_SIZE);

        await prisma.signup.createMany({ data: signupBatch });
        await prisma.regularSignup.createMany({ data: regularSignupBatch });
      }
    } catch (error) {
      console.error("Bulk creation error:", error);
      redirect("/admin/shifts/new?error=bulk_create");
    }

    redirect(`/admin/shifts?created=${shifts.length}`);
  }

  async function createTemplate(formData: FormData) {
    "use server";

    const schema = z.object({
      name: z
        .string()
        .min(1, "Template name is required")
        .max(100, "Name too long"),
      shiftTypeId: z.string().cuid(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      location: z.string().min(1, "Location is required"),
      capacity: z.coerce.number().int().min(1).max(1000),
      notes: z
        .string()
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    });

    const parsed = schema.safeParse({
      name: formData.get("name"),
      shiftTypeId: formData.get("shiftTypeId"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      location: formData.get("location"),
      capacity: formData.get("capacity"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      redirect("/admin/shifts/new?error=template_validation");
    }

    const { name, shiftTypeId, startTime, endTime, location, capacity, notes } =
      parsed.data;

    try {
      await prisma.shiftTemplate.create({
        data: {
          name,
          shiftTypeId,
          startTime,
          endTime,
          location: location,
          capacity,
          notes,
          isActive: true,
        },
      });
      redirect("/admin/shifts/new?template_created=1");
    } catch (error) {
      console.error("Template creation error:", error);
      redirect("/admin/shifts/new?error=template_create");
    }
  }

  async function editTemplate(formData: FormData) {
    "use server";

    const schema = z.object({
      templateId: z.string().cuid(),
      name: z
        .string()
        .min(1, "Template name is required")
        .max(100, "Name too long"),
      shiftTypeId: z.string().cuid(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      location: z.string().min(1, "Location is required"),
      capacity: z.coerce.number().int().min(1).max(1000),
      notes: z
        .string()
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    });

    const parsed = schema.safeParse({
      templateId: formData.get("templateId"),
      name: formData.get("name"),
      shiftTypeId: formData.get("shiftTypeId"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
      location: formData.get("location"),
      capacity: formData.get("capacity"),
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      redirect("/admin/shifts/new?error=template_validation");
    }

    const {
      templateId,
      name,
      shiftTypeId,
      startTime,
      endTime,
      location,
      capacity,
      notes,
    } = parsed.data;

    try {
      await prisma.shiftTemplate.update({
        where: { id: templateId },
        data: {
          name,
          shiftTypeId,
          startTime,
          endTime,
          location: location,
          capacity,
          notes,
        },
      });
      redirect("/admin/shifts/new?template_updated=1");
    } catch (error) {
      console.error("Template edit error:", error);
      redirect("/admin/shifts/new?error=template_edit");
    }
  }

  async function deleteTemplate(formData: FormData) {
    "use server";

    const templateId = formData.get("templateId") as string;
    if (!templateId) {
      redirect("/admin/shifts/new?error=template_invalid");
    }

    try {
      await prisma.shiftTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
      });
      redirect("/admin/shifts/new?template_deleted=1");
    } catch (error) {
      console.error("Template deletion error:", error);
      redirect("/admin/shifts/new?error=template_delete");
    }
  }

  async function createShiftType(formData: FormData) {
    "use server";

    const schema = z.object({
      name: z.string().min(1, "Name is required").max(100, "Name too long"),
      description: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v && v.length > 0 ? v : null)),
    });

    const parsed = schema.safeParse({
      name: formData.get("name"),
      description: formData.get("description"),
    });

    if (!parsed.success) {
      redirect("/admin/shifts/new?error=shift_type_validation");
    }

    const { name, description } = parsed.data;

    try {
      // Check if shift type with this name already exists
      const existing = await prisma.shiftType.findUnique({
        where: { name },
      });

      if (existing) {
        redirect("/admin/shifts/new?error=shift_type_exists");
      }

      await prisma.shiftType.create({
        data: {
          name,
          description,
        },
      });

      redirect("/admin/shifts/new?shift_type_created=1");
    } catch (error) {
      console.error("Shift type creation error:", error);
      redirect("/admin/shifts/new?error=shift_type_create");
    }
  }

  const shiftTypes = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
  });

  // Fetch shift templates from database
  const dbTemplates = await prisma.shiftTemplate.findMany({
    where: { isActive: true },
    include: { shiftType: true },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });

  // Convert database templates to the format expected by the component
  const templatesWithShiftTypes = Object.fromEntries(
    dbTemplates.map((template) => [
      template.name,
      {
        name: template.name,
        startTime: template.startTime,
        endTime: template.endTime,
        capacity: template.capacity,
        notes: template.notes || "",
        shiftTypeId: template.shiftTypeId,
        location: template.location || undefined, // Convert null to undefined to match interface
        id: template.id, // Include database ID for editing/deleting
      },
    ])
  );

  return (
    <AdminPageWrapper
      title="Create shifts"
      description="Schedule new volunteer shifts efficiently with single or bulk creation options."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/shifts">← Back to shifts</Link>
        </Button>
      }
    >
      <PageContainer testid="create-shift-page">
        <Tabs defaultValue="bulk" className="space-y-6">
          <ScrollableTabsList>
            <TabsTrigger value="single" className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Single Shift
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4" />
              Weekly Schedule
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <RefreshCwIcon className="h-4 w-4" />
              Edit Templates
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Single Shift Creation */}
          <TabsContent value="single">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <PlusIcon className="h-5 w-5" />
                  Create Single Shift
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create a single volunteer shift with specific details.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                <form action={createShift} className="space-y-8">
                  <ShiftCreationClientForm
                    shiftTypes={shiftTypes}
                    initialTemplates={templatesWithShiftTypes}
                    locations={sortedLocations}
                    createShiftTypeAction={createShiftType}
                  />
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk Creation */}
          <TabsContent value="bulk">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <CalendarDaysIcon className="h-5 w-5" />
                  Create Weekly Schedule
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create multiple shifts across several days using templates for
                  efficient weekly planning.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                <form action={createBulkShifts} className="space-y-8">
                  {/* Date Range */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      Date Range
                    </h3>
                    <BulkDateRangeSection />
                  </div>

                  {/* Days Selection */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      Days of Week
                    </h3>
                    <div className="grid grid-cols-3 lg:grid-cols-7 gap-3">
                      {[
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            name={`day_${day}`}
                            id={`day_${day}`}
                            defaultChecked={true}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            data-testid={`day-${day.toLowerCase()}-checkbox`}
                          />
                          <Label htmlFor={`day_${day}`} className="text-sm">
                            {day.slice(0, 3)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Template Selection - Grouped by Location */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      Shift Templates
                    </h3>
                    {(() => {
                      // Group templates by location
                      const templatesByLocation = Object.entries(
                        templatesWithShiftTypes
                      ).reduce((acc, [name, template]) => {
                        const location = template.location || "General";
                        if (!acc[location]) acc[location] = [];
                        acc[location].push([name, template]);
                        return acc;
                      }, {} as Record<string, [string, (typeof templatesWithShiftTypes)[string]][]>);

                      return (
                        <CollapsibleTemplateSelection
                          templatesByLocation={templatesByLocation}
                          sortedLocations={sortedLocations}
                          shiftTypes={shiftTypes}
                        />
                      );
                    })()}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="order-2 sm:order-1"
                    >
                      <Link href="/admin/shifts">Cancel</Link>
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      className="order-1 sm:order-2 bg-primary hover:bg-primary/90"
                    >
                      <CalendarDaysIcon className="h-4 w-4 mr-2" />
                      Create Schedule
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Edit Templates */}
          <TabsContent value="templates">
            <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
              <CardHeader className="pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <RefreshCwIcon className="h-5 w-5" />
                  Manage Shift Templates
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create, edit, and organize shift templates for efficient
                  scheduling.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {dbTemplates.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        Existing Templates
                      </h3>
                      <CreateTemplateDialog
                        shiftTypes={shiftTypes}
                        locations={sortedLocations}
                        createAction={createTemplate}
                      />
                    </div>
                    <div className="space-y-3">
                      {dbTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 dark:hover:bg-accent/30 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {template.shiftType.name} •{" "}
                              {template.location || "General"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {template.startTime} - {template.endTime} •{" "}
                              {template.capacity} volunteers
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <EditTemplateDialog
                              template={{
                                id: template.id,
                                name: template.name,
                                shiftTypeId: template.shiftTypeId,
                                startTime: template.startTime,
                                endTime: template.endTime,
                                location: template.location,
                                capacity: template.capacity,
                                notes: template.notes,
                              }}
                              shiftTypes={shiftTypes}
                              locations={sortedLocations}
                              editAction={editTemplate}
                            />
                            <DeleteTemplateForm
                              templateId={template.id}
                              templateName={template.name}
                              deleteAction={deleteTemplate}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-muted/50 dark:bg-muted/20 rounded-lg border border-dashed border-border">
                    <div className="h-12 w-12 bg-muted dark:bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4">
                      <PlusIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      No templates found
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Templates help you quickly create consistent shifts across
                      different days.
                    </p>
                    <CreateTemplateDialog
                      shiftTypes={shiftTypes}
                      locations={sortedLocations}
                      createAction={createTemplate}
                      triggerText="Create First Template"
                      triggerVariant="default"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AdminPageWrapper>
  );
}
