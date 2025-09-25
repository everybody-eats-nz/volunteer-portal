"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontalIcon,
  EditIcon,
  TrashIcon,
  PauseIcon,
  PlayIcon,
  UserIcon,
  CalendarIcon,
  MapPinIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

type RegularVolunteer = {
  id: string;
  userId: string;
  location: string;
  frequency: string;
  availableDays: string[];
  isActive: boolean;
  isPausedByUser: boolean;
  pausedUntil: Date | null;
  notes: string | null;
  volunteerNotes: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  shiftType: {
    id: string;
    name: string;
  };
  _count: {
    autoSignups: number;
  };
};

export function RegularsTable({ regulars }: { regulars: RegularVolunteer[] }) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggleId, setToggleId] = useState<string | null>(null);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/regulars/${id}/toggle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to toggle status");
      }

      toast.success(
        `Regular volunteer ${!currentStatus ? "activated" : "deactivated"}`
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to toggle status");
    } finally {
      setToggleId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/regulars/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove regular status");
      }

      toast.success("Regular volunteer status removed");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove regular status");
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusBadge = (regular: RegularVolunteer) => {
    if (!regular.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (regular.isPausedByUser) {
      return <Badge variant="warning">Paused</Badge>;
    }
    return <Badge variant="success">Active</Badge>;
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

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Regular Volunteers</h2>
          <p className="text-sm text-muted-foreground">
            Manage volunteers with recurring shift assignments
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volunteer</TableHead>
                <TableHead>Shift Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Auto-Signups</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regulars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-muted-foreground">
                      No regular volunteers yet
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                regulars.map((regular) => (
                  <TableRow key={regular.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {regular.user.firstName} {regular.user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {regular.user.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">{regular.shiftType.name}</Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                        {regular.location}
                      </div>
                    </TableCell>

                    <TableCell>
                      {getFrequencyLabel(regular.frequency)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatDays(regular.availableDays)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(regular)}
                      {regular.pausedUntil && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Until {format(new Date(regular.pausedUntil), "MMM d")}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">
                        {regular._count.autoSignups}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/admin/regulars/${regular.id}/edit`)
                            }
                          >
                            <EditIcon className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => setToggleId(regular.id)}
                          >
                            {regular.isActive ? (
                              <>
                                <PauseIcon className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <PlayIcon className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => setDeleteId(regular.id)}
                            className="text-destructive"
                          >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Remove Regular Status
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Toggle Confirmation Dialog */}
      <AlertDialog open={!!toggleId} onOpenChange={() => setToggleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {regulars.find((r) => r.id === toggleId)?.isActive
                ? "Deactivate Regular Volunteer?"
                : "Activate Regular Volunteer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {regulars.find((r) => r.id === toggleId)?.isActive
                ? "This will stop auto-creating signups for this volunteer. Any existing REGULAR_PENDING signups will be canceled."
                : "This will resume auto-creating signups for this volunteer when matching shifts are created."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const regular = regulars.find((r) => r.id === toggleId);
                if (regular) {
                  handleToggle(regular.id, regular.isActive);
                }
              }}
            >
              {regulars.find((r) => r.id === toggleId)?.isActive
                ? "Deactivate"
                : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove Regular Volunteer Status?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the regular volunteer status for{" "}
              {regulars.find((r) => r.id === deleteId)?.user.firstName}{" "}
              {regulars.find((r) => r.id === deleteId)?.user.lastName}. Any
              pending auto-generated signups will be canceled. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Regular Status
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
