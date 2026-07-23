import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { PlusIcon, CalendarDaysIcon, LayersIcon } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { RedirectFeedback } from "@/components/shift-creation/redirect-feedback";
import { ShiftTypeManager } from "@/components/shift-creation/shift-type-manager";
import { WeeklyPlanner } from "@/components/shift-creation/weekly-planner";
import { SingleShiftPlanner } from "@/components/shift-creation/single-shift-planner";
import { TemplateLibrary } from "@/components/shift-creation/template-library";
import type { TemplateOption } from "@/components/shift-creation/types";
import {
  formatInNZT,
  createNZDate,
  parseISOInNZT,
  nowInNZT,
  toUTC,
} from "@/lib/timezone";
import { getActiveLocationNames } from "@/lib/locations";
import { createShiftRecord } from "@/lib/services/shift-service";
import { createRegularVolunteerSignups } from "@/lib/regular-volunteer-utils";

// Templates are stored in the database and fetched dynamically

const VALID_TABS = ["bulk", "single", "templates"] as const;

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab = (VALID_TABS as readonly string[]).includes(tab ?? "")
    ? (tab as string)
    : "bulk";
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user) redirect("/login?callbackUrl=/admin/shifts/new");
  if (role !== "ADMIN") redirect("/shifts");

  const sortedLocations = await getActiveLocationNames();

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
      redirect("/admin/shifts/new?error=validation&tab=single");
    }

    const { shiftTypeId, date, startTime, endTime, location, capacity, notes } =
      parsed.data;

    // Parse time components and create dates in NZ timezone
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);
    const start = createNZDate(date, startHour, startMinute);
    const end = createNZDate(date, endHour, endMinute);

    if (!(start instanceof Date) || isNaN(start.getTime()))
      redirect("/admin/shifts/new?error=startdate&tab=single");
    if (!(end instanceof Date) || isNaN(end.getTime()))
      redirect("/admin/shifts/new?error=enddate&tab=single");
    if (end <= start) redirect("/admin/shifts/new?error=range&tab=single");

    // Use NZ timezone for "now" to ensure consistent validation
    const now = toUTC(nowInNZT());
    if (start <= now) redirect("/admin/shifts/new?error=past&tab=single");

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

      // Auto-assign matching regular volunteers
      const dayOfWeek = formatInNZT(start, "EEEE");
      const regularVolunteers = await prisma.regularVolunteer.findMany({
        where: {
          shiftTypeId,
          ...(location && { location }),
          isActive: true,
          isPausedByUser: false,
          availableDays: { has: dayOfWeek },
        },
      });

      await createRegularVolunteerSignups([shift], regularVolunteers);
    } catch (error) {
      console.error("Shift creation error:", error);
      redirect("/admin/shifts/new?error=create&tab=single");
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
      // Create all shifts and return them (avoids fragile re-query)
      const createdShifts = await prisma.shift.createManyAndReturn({
        data: shifts,
      });

      // Auto-assign matching regular volunteers to all created shifts
      const shiftConfigs = new Map<string, Set<string>>();
      for (const shift of createdShifts) {
        const dayOfWeek = formatInNZT(shift.start, "EEEE");
        const key = `${shift.shiftTypeId}|${shift.location || ""}`;
        if (!shiftConfigs.has(key)) {
          shiftConfigs.set(key, new Set());
        }
        shiftConfigs.get(key)!.add(dayOfWeek);
      }

      const allRegularVolunteers = (
        await Promise.all(
          Array.from(shiftConfigs.entries()).map(([key, days]) => {
            const [shiftTypeId, location] = key.split("|");
            return prisma.regularVolunteer.findMany({
              where: {
                shiftTypeId,
                ...(location && { location }),
                isActive: true,
                isPausedByUser: false,
                availableDays: { hasSome: Array.from(days) },
              },
            });
          })
        )
      ).flat();

      await createRegularVolunteerSignups(createdShifts, allRegularVolunteers);
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
      redirect("/admin/shifts/new?error=template_validation&tab=templates");
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
    } catch (error) {
      console.error("Template creation error:", error);
      redirect("/admin/shifts/new?error=template_create&tab=templates");
    }
    redirect("/admin/shifts/new?template_created=1&tab=templates");
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
      redirect("/admin/shifts/new?error=template_validation&tab=templates");
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
    } catch (error) {
      console.error("Template edit error:", error);
      redirect("/admin/shifts/new?error=template_edit&tab=templates");
    }
    redirect("/admin/shifts/new?template_updated=1&tab=templates");
  }

  async function deleteTemplate(formData: FormData) {
    "use server";

    const templateId = formData.get("templateId") as string;
    if (!templateId) {
      redirect("/admin/shifts/new?error=template_invalid&tab=templates");
    }

    try {
      await prisma.shiftTemplate.update({
        where: { id: templateId },
        data: { isActive: false },
      });
    } catch (error) {
      console.error("Template deletion error:", error);
      redirect("/admin/shifts/new?error=template_delete&tab=templates");
    }
    redirect("/admin/shifts/new?template_deleted=1&tab=templates");
  }

  async function createShiftType(formData: FormData) {
    "use server";

    // The create dialog lives on both the Single Shift tab and the
    // Templates & Roles tab - return the admin to wherever they came from.
    const returnTab =
      formData.get("returnTab") === "single" ? "single" : "templates";

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
      redirect(`/admin/shifts/new?error=shift_type_validation&tab=${returnTab}`);
    }

    const { name, description } = parsed.data;

    // Check if shift type with this name already exists
    const existing = await prisma.shiftType.findUnique({
      where: { name },
    });

    if (existing) {
      redirect(`/admin/shifts/new?error=shift_type_exists&tab=${returnTab}`);
    }

    try {
      await prisma.shiftType.create({
        data: {
          name,
          description,
        },
      });
    } catch (error) {
      console.error("Shift type creation error:", error);
      redirect(`/admin/shifts/new?error=shift_type_create&tab=${returnTab}`);
    }

    redirect(`/admin/shifts/new?shift_type_created=1&tab=${returnTab}`);
  }

  async function editShiftType(formData: FormData) {
    "use server";

    const schema = z.object({
      shiftTypeId: z.string().cuid(),
      name: z.string().min(1, "Name is required").max(100, "Name too long"),
      description: z
        .string()
        .optional()
        .nullable()
        .transform((v) => (v && v.length > 0 ? v : null)),
    });

    const parsed = schema.safeParse({
      shiftTypeId: formData.get("shiftTypeId"),
      name: formData.get("name"),
      description: formData.get("description"),
    });

    if (!parsed.success) {
      redirect("/admin/shifts/new?error=shift_type_validation&tab=templates");
    }

    const { shiftTypeId, name, description } = parsed.data;

    // The name is unique - make sure it isn't taken by another type
    const existing = await prisma.shiftType.findUnique({ where: { name } });
    if (existing && existing.id !== shiftTypeId) {
      redirect("/admin/shifts/new?error=shift_type_exists&tab=templates");
    }

    try {
      await prisma.shiftType.update({
        where: { id: shiftTypeId },
        data: { name, description },
      });
    } catch (error) {
      console.error("Shift type edit error:", error);
      redirect("/admin/shifts/new?error=shift_type_edit&tab=templates");
    }

    redirect("/admin/shifts/new?shift_type_updated=1&tab=templates");
  }

  async function deleteShiftType(formData: FormData) {
    "use server";

    const shiftTypeId = formData.get("shiftTypeId") as string;
    if (!shiftTypeId) {
      redirect("/admin/shifts/new?error=shift_type_invalid&tab=templates");
    }

    const shiftType = await prisma.shiftType.findUnique({
      where: { id: shiftTypeId },
      include: {
        _count: {
          select: {
            shifts: true,
            shiftTemplates: true,
            regularVolunteers: true,
            autoAcceptRules: true,
          },
        },
      },
    });

    if (!shiftType) {
      redirect("/admin/shifts/new?error=shift_type_invalid&tab=templates");
    }

    // Shift types are referenced by shifts, templates, regular volunteers,
    // and auto-accept rules - deleting one that is in use would orphan them.
    const inUse =
      shiftType._count.shifts +
        shiftType._count.shiftTemplates +
        shiftType._count.regularVolunteers +
        shiftType._count.autoAcceptRules >
      0;
    if (inUse) {
      redirect("/admin/shifts/new?error=shift_type_in_use&tab=templates");
    }

    try {
      await prisma.shiftType.delete({ where: { id: shiftTypeId } });
    } catch (error) {
      console.error("Shift type deletion error:", error);
      redirect("/admin/shifts/new?error=shift_type_delete&tab=templates");
    }

    redirect("/admin/shifts/new?shift_type_deleted=1&tab=templates");
  }

  const shiftTypesWithUsage = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          shifts: true,
          shiftTemplates: true,
          regularVolunteers: true,
          autoAcceptRules: true,
        },
      },
    },
  });

  const shiftTypes = shiftTypesWithUsage.map((type) => ({
    id: type.id,
    name: type.name,
  }));

  const shiftTypeDetails = shiftTypesWithUsage.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description,
    templateCount: type._count.shiftTemplates,
    shiftCount: type._count.shifts,
    inUse:
      type._count.shifts +
        type._count.shiftTemplates +
        type._count.regularVolunteers +
        type._count.autoAcceptRules >
      0,
  }));

  // Fetch shift templates from database
  const dbTemplates = await prisma.shiftTemplate.findMany({
    where: { isActive: true },
    include: { shiftType: true },
    orderBy: [{ location: "asc" }, { name: "asc" }],
  });

  const templateOptions: TemplateOption[] = dbTemplates.map((template) => ({
    id: template.id,
    name: template.name,
    shiftTypeId: template.shiftTypeId,
    shiftTypeName: template.shiftType.name,
    location: template.location || "",
    startTime: template.startTime,
    endTime: template.endTime,
    capacity: template.capacity,
    notes: template.notes || "",
  }));

  const tabTriggerClasses =
    "h-10 rounded-full px-4 gap-2 text-sm font-medium cursor-pointer " +
    "data-[state=active]:bg-forest-500 data-[state=active]:text-cream-50 data-[state=active]:shadow-none " +
    "dark:data-[state=active]:bg-forest-500 dark:data-[state=active]:text-cream-50 dark:data-[state=active]:border-transparent";

  return (
    <AdminPageWrapper
      title="Create shifts"
      description="Plan whole weeks from templates, or add a one-off shift."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/shifts">← Back to shifts</Link>
        </Button>
      }
    >
      <PageContainer testid="create-shift-page">
        <Suspense fallback={null}>
          <RedirectFeedback />
        </Suspense>
        <Tabs defaultValue={initialTab} className="gap-6">
          <ScrollableTabsList className="h-12 rounded-full border border-border bg-card p-1 dark:border-border dark:bg-card">
            <TabsTrigger value="bulk" className={tabTriggerClasses}>
              <CalendarDaysIcon className="h-4 w-4" />
              Weekly Schedule
            </TabsTrigger>
            <TabsTrigger value="single" className={tabTriggerClasses}>
              <PlusIcon className="h-4 w-4" />
              Single Shift
            </TabsTrigger>
            <TabsTrigger value="templates" className={tabTriggerClasses}>
              <LayersIcon className="h-4 w-4" />
              Templates & Roles
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Weekly schedule (default): the main operational task */}
          <TabsContent value="bulk">
            <WeeklyPlanner
              templates={templateOptions}
              locations={sortedLocations}
              action={createBulkShifts}
            />
          </TabsContent>

          {/* One-off shift */}
          <TabsContent value="single">
            <SingleShiftPlanner
              shiftTypes={shiftTypes}
              templates={templateOptions}
              locations={sortedLocations}
              action={createShift}
              createShiftTypeAction={createShiftType}
            />
          </TabsContent>

          {/* Template library: the building blocks of the weekly schedule */}
          <TabsContent value="templates" className="space-y-6">
            <TemplateLibrary
              templates={templateOptions}
              shiftTypes={shiftTypes}
              locations={[...sortedLocations]}
              createAction={createTemplate}
              editAction={editTemplate}
              deleteAction={deleteTemplate}
            />
            <ShiftTypeManager
              shiftTypes={shiftTypeDetails}
              createAction={createShiftType}
              editAction={editShiftType}
              deleteAction={deleteShiftType}
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </AdminPageWrapper>
  );
}
