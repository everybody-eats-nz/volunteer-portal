import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Badge } from "@/components/ui/badge";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
  FileTextIcon,
  EditIcon,
  AlertTriangleIcon,
  Trash2Icon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeleteShiftDialog } from "@/components/delete-shift-dialog";
import { PageContainer } from "@/components/page-container";
import { LOCATIONS } from "@/lib/locations";

type ShiftType = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default async function EditShiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user) redirect("/login?callbackUrl=/admin/shifts");
  if (role !== "ADMIN") redirect("/shifts");

  const { id } = await params;
  const urlParams = await searchParams;

  // Fetch the shift to edit
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: true,
      signups: {
        include: { user: true },
      },
    },
  });

  if (!shift) {
    notFound();
  }

  const shiftTypes = await prisma.shiftType.findMany({
    orderBy: { name: "asc" },
  });

  // Count active signups
  const activeSignups = shift.signups.filter(
    (signup) => signup.status !== "CANCELED" && signup.status !== "NO_SHOW"
  );
  const hasSignups = activeSignups.length > 0;

  async function updateShift(formData: FormData) {
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
      redirect(`/admin/shifts/${id}/edit?error=validation`);
    }

    const { shiftTypeId, date, startTime, endTime, location, capacity, notes } =
      parsed.data;

    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);

    if (!(start instanceof Date) || isNaN(start.getTime()))
      redirect(`/admin/shifts/${id}/edit?error=startdate`);
    if (!(end instanceof Date) || isNaN(end.getTime()))
      redirect(`/admin/shifts/${id}/edit?error=enddate`);
    if (end <= start) redirect(`/admin/shifts/${id}/edit?error=range`);

    // Allow editing past shifts for admin corrections, but warn about it
    const now = new Date();
    const isPastShift = start <= now;

    try {
      await prisma.shift.update({
        where: { id },
        data: {
          shiftTypeId,
          start,
          end,
          location,
          capacity,
          notes: notes ?? null,
        },
      });
    } catch {
      redirect(`/admin/shifts/${id}/edit?error=update`);
    }

    redirect(`/admin/shifts?updated=1${isPastShift ? "&past=1" : ""}`);
  }

  async function deleteShift() {
    "use server";

    try {
      // First delete all signups for this shift
      await prisma.signup.deleteMany({
        where: { shiftId: id },
      });

      // Then delete the shift
      await prisma.shift.delete({
        where: { id },
      });
    } catch {
      redirect(`/admin/shifts/${id}/edit?error=delete`);
    }

    redirect("/admin/shifts?deleted=1");
  }

  // Format existing shift data for form defaults
  const formatDate = (date: Date) => format(date, "yyyy-MM-dd");
  const formatTime = (date: Date) => format(date, "HH:mm");

  const defaultValues = {
    shiftTypeId: shift.shiftTypeId,
    date: formatDate(shift.start),
    startTime: formatTime(shift.start),
    endTime: formatTime(shift.end),
    location: shift.location || "",
    capacity: shift.capacity.toString(),
    notes: shift.notes || "",
  };

  // Error handling
  const error = Array.isArray(urlParams.error)
    ? urlParams.error[0]
    : urlParams.error;

  const getErrorMessage = (error: string | undefined) => {
    switch (error) {
      case "validation":
        return "Please check your input and try again.";
      case "startdate":
        return "Invalid start date format.";
      case "enddate":
        return "Invalid end date format.";
      case "range":
        return "End time must be after start time.";
      case "update":
        return "Failed to update shift. Please try again.";
      case "delete":
        return "Failed to delete shift. Please try again.";
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);
  const isPastShift = shift.start <= new Date();

  const description = `Modify details for ${shift.shiftType.name} on ${format(
    shift.start,
    "EEEE, MMMM d, yyyy"
  )}`;

  const headerActions = (
    <>
      <DeleteShiftDialog
        shiftId={shift.id}
        shiftName={shift.shiftType.name}
        shiftDate={format(shift.start, "EEEE, MMMM d, yyyy")}
        hasSignups={hasSignups}
        signupCount={activeSignups.length}
        onDelete={deleteShift}
      >
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          data-testid="delete-shift-from-edit-button"
        >
          <Trash2Icon className="h-4 w-4 mr-2" />
          Delete Shift
        </Button>
      </DeleteShiftDialog>
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/shifts">← Back to shifts</Link>
      </Button>
    </>
  );

  return (
    <AdminPageWrapper
      title="Edit shift"
      description={description}
      actions={headerActions}
    >
      <PageContainer testid="edit-shift-page">
        {errorMessage && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {isPastShift && (
          <Alert className="mb-6">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              You are editing a past shift. Changes may affect historical
              records.
            </AlertDescription>
          </Alert>
        )}

        {hasSignups && (
          <Alert className="mb-6">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              This shift has {activeSignups.length} active signup(s). Reducing
              capacity below this number may affect volunteer assignments.
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <EditIcon className="h-5 w-5" />
              Edit Shift Details
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Update the shift information below. Required fields are marked
              with an asterisk (*).
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            <form action={updateShift} className="space-y-8">
              {/* Shift Type Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Shift Type
                  </h3>
                </div>
                <div>
                  <Label
                    htmlFor="shiftTypeId"
                    className="text-sm font-medium mb-2 block"
                  >
                    Select shift type *
                  </Label>
                  <SelectField
                    name="shiftTypeId"
                    id="shiftTypeId"
                    placeholder="Choose the type of volunteer work..."
                    required
                    defaultValue={defaultValues.shiftTypeId}
                    options={shiftTypes.map((t: ShiftType) => ({
                      value: t.id,
                      label: t.name,
                    }))}
                    className="w-full"
                    data-testid="edit-shift-type-select"
                  />
                </div>
              </div>

              {/* Date & Time Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Schedule
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="date"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      Date *
                    </Label>
                    <Input
                      type="date"
                      name="date"
                      id="date"
                      required
                      defaultValue={defaultValues.date}
                      className="h-11"
                      data-testid="edit-shift-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="startTime"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      Start time *
                    </Label>
                    <Input
                      type="time"
                      name="startTime"
                      id="startTime"
                      required
                      defaultValue={defaultValues.startTime}
                      className="h-11"
                      data-testid="edit-shift-start-time-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="endTime"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      End time *
                    </Label>
                    <Input
                      type="time"
                      name="endTime"
                      id="endTime"
                      required
                      defaultValue={defaultValues.endTime}
                      className="h-11"
                      data-testid="edit-shift-end-time-input"
                    />
                  </div>
                </div>
              </div>

              {/* Location & Capacity Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Location & Capacity
                  </h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="location"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                      Location *
                    </Label>
                    <SelectField
                      name="location"
                      id="location"
                      placeholder="Choose a location..."
                      required
                      defaultValue={defaultValues.location}
                      options={LOCATIONS.map((loc) => ({
                        value: loc,
                        label: loc,
                      }))}
                      className="w-full"
                      data-testid="edit-shift-location-select"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="capacity"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      Volunteer capacity *
                    </Label>
                    <Input
                      type="number"
                      name="capacity"
                      id="capacity"
                      min={Math.max(1, activeSignups.length)}
                      step={1}
                      placeholder="e.g. 6"
                      required
                      defaultValue={defaultValues.capacity}
                      className="h-11"
                      data-testid="edit-shift-capacity-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      {hasSignups
                        ? `Minimum capacity: ${activeSignups.length} (current active signups)`
                        : "Maximum number of volunteers needed"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Additional Information
                  </h3>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="notes"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                    Notes (optional)
                  </Label>
                  <Textarea
                    name="notes"
                    id="notes"
                    rows={4}
                    placeholder="Add any special instructions, requirements, or additional details for volunteers..."
                    defaultValue={defaultValues.notes}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    These notes will be visible to volunteers when they view the
                    shift details.
                  </p>
                </div>
              </div>

              {/* Signup Summary */}
              {hasSignups && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      Current Signups
                    </h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
                        {
                          shift.signups.filter((s) => s.status === "CONFIRMED")
                            .length
                        }{" "}
                        confirmed
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-700 border-orange-200"
                      >
                        {
                          shift.signups.filter((s) => s.status === "PENDING")
                            .length
                        }{" "}
                        pending
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        {
                          shift.signups.filter((s) => s.status === "WAITLISTED")
                            .length
                        }{" "}
                        waitlisted
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Consider the impact of your changes on these volunteer
                      signups.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="order-2 sm:order-1"
                  data-testid="cancel-edit-shift-button"
                >
                  <Link href="/admin/shifts">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="order-1 sm:order-2 bg-primary hover:bg-primary/90"
                  data-testid="update-shift-button"
                >
                  <EditIcon className="h-4 w-4 mr-2" />
                  Update shift
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageContainer>
    </AdminPageWrapper>
  );
}
