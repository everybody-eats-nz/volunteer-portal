"use client";

import { useState, useEffect } from "react";
import { formatInNZT } from "@/lib/timezone";
import { useRouter } from "next/navigation";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoBox } from "@/components/ui/info-box";
import { MotionSpinner } from "@/components/motion-spinner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AssignVolunteerDialogProps {
  shift: {
    id: string;
    start: Date;
    end: Date;
    location: string | null;
    capacity: number;
    shiftType: {
      name: string;
      description?: string | null;
    };
  };
  confirmedCount: number;
  children: React.ReactNode; // The trigger button
}

interface Volunteer {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
}

function getDurationInHours(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  return `${wholeHours}h ${minutes}m`;
}

export function AssignVolunteerDialog({
  shift,
  confirmedCount,
  children,
}: AssignVolunteerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(
    null
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const duration = getDurationInHours(shift.start, shift.end);
  const remaining = Math.max(0, shift.capacity - confirmedCount);
  const isOverCapacity = confirmedCount >= shift.capacity;

  // Clear state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setError(null);
      setSuccessMessage(null);
      setSearchQuery("");
      setVolunteers([]);
      setSelectedVolunteer(null);
      setNote("");
    }
  }, [open]);

  // Debounced search for volunteers
  useEffect(() => {
    if (!searchQuery.trim()) {
      setVolunteers([]);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/volunteers/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setVolunteers(data.volunteers || []);
        } else {
          console.error("Volunteer search failed:", response.status);
          setVolunteers([]);
        }
      } catch (error) {
        console.error("Error searching volunteers:", error);
        setVolunteers([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleAssignVolunteer = async () => {
    if (!selectedVolunteer) {
      setError("Please select a volunteer");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/shifts/${shift.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          volunteerId: selectedVolunteer.id,
          status: "CONFIRMED",
          note: note.trim() || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(
          result.message || "Volunteer successfully assigned to shift"
        );

        // Wait a moment to show success message, then close and refresh
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to assign volunteer");
      }
    } catch (error) {
      console.error("Assign volunteer error:", error);
      setError("Failed to assign volunteer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVolunteerDisplayName = (volunteer: Volunteer) => {
    return (
      volunteer.name ||
      `${volunteer.firstName || ""} ${volunteer.lastName || ""}`.trim() ||
      volunteer.email
    );
  };

  const getVolunteerInitials = (volunteer: Volunteer) => {
    if (volunteer.firstName && volunteer.lastName) {
      return `${volunteer.firstName[0]}${volunteer.lastName[0]}`.toUpperCase();
    }
    if (volunteer.name) {
      const nameParts = volunteer.name.split(" ");
      return nameParts.length > 1
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : volunteer.name.slice(0, 2).toUpperCase();
    }
    return volunteer.email.slice(0, 2).toUpperCase();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild data-testid="assign-volunteer-trigger">
        {children}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-md flex flex-col max-h-[85vh]"
        data-testid="assign-volunteer-dialog"
      >
        <ResponsiveDialogHeader data-testid="assign-volunteer-dialog-header">
          <ResponsiveDialogTitle
            className="flex items-center gap-2"
            data-testid="assign-volunteer-dialog-title"
          >
            👥 Assign Volunteer to Shift
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription data-testid="assign-volunteer-dialog-description">
            Manually assign a volunteer to this shift. They will be notified by
            email.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div
          className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0"
          data-testid="assign-volunteer-dialog-content-body"
        >
          {/* Shift Details */}
          <div
            className="rounded-lg border p-4 bg-muted/50"
            data-testid="shift-details-section"
          >
            <h3
              className="font-semibold text-lg mb-2"
              data-testid="shift-details-name"
            >
              {shift.shiftType.name}
            </h3>

            <div
              className="space-y-2 text-sm"
              data-testid="shift-details-info"
            >
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-date"
              >
                <span className="font-medium">📅 Date:</span>
                <span>{formatInNZT(shift.start, "EEEE, dd MMMM yyyy")}</span>
              </div>
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-time"
              >
                <span className="font-medium">🕐 Time:</span>
                <span>
                  {formatInNZT(shift.start, "h:mm a")} -{" "}
                  {formatInNZT(shift.end, "h:mm a")}
                </span>
                <Badge
                  variant="outline"
                  className="text-xs"
                  data-testid="shift-details-duration"
                >
                  {duration}
                </Badge>
              </div>
              {shift.location && (
                <div
                  className="flex items-center gap-2"
                  data-testid="shift-details-location"
                >
                  <span className="font-medium">📍 Location:</span>
                  <span>{shift.location}</span>
                </div>
              )}
              <div
                className="flex items-center gap-2"
                data-testid="shift-details-capacity"
              >
                <span className="font-medium">👥 Capacity:</span>
                <span>
                  {confirmedCount}/{shift.capacity} confirmed
                  {remaining > 0 ? (
                    <span className="text-green-600 ml-1">
                      ({remaining} spots left)
                    </span>
                  ) : (
                    <span className="text-orange-600 ml-1">(Full)</span>
                  )}
                </span>
              </div>
            </div>

            {isOverCapacity && (
              <InfoBox
                title="⚠️ Shift is at capacity"
                variant="amber"
                testId="capacity-warning"
                className="mt-3"
              >
                <p className="text-sm">
                  This shift is currently full. Assigning another volunteer will
                  exceed the capacity.
                </p>
              </InfoBox>
            )}
          </div>

          {/* Volunteer Search */}
          <div className="space-y-2">
            <Label htmlFor="volunteer-search">
              Search Volunteer{" "}
              <span className="text-red-500" data-testid="required-indicator">
                *
              </span>
            </Label>
            <Input
              id="volunteer-search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="volunteer-search-input"
              autoComplete="off"
            />

            {/* Selected Volunteer Display */}
            {selectedVolunteer && (
              <div
                className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg"
                data-testid="selected-volunteer-display"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={selectedVolunteer.profilePhotoUrl || undefined}
                    alt={getVolunteerDisplayName(selectedVolunteer)}
                  />
                  <AvatarFallback>
                    {getVolunteerInitials(selectedVolunteer)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">
                    {getVolunteerDisplayName(selectedVolunteer)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedVolunteer.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedVolunteer(null)}
                  data-testid="clear-selected-volunteer"
                >
                  ✕
                </Button>
              </div>
            )}

            {/* Search Results */}
            {!selectedVolunteer &&
              searchQuery.trim() &&
              (isSearching ? (
                <div
                  className="flex items-center justify-center p-4"
                  data-testid="volunteer-search-loading"
                >
                  <MotionSpinner className="w-5 h-5" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Searching...
                  </span>
                </div>
              ) : volunteers.length > 0 ? (
                <div
                  className="border rounded-lg divide-y max-h-60 overflow-y-auto"
                  data-testid="volunteer-search-results"
                >
                  {volunteers.map((volunteer) => (
                    <button
                      key={volunteer.id}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => {
                        setSelectedVolunteer(volunteer);
                        setSearchQuery("");
                        setVolunteers([]);
                      }}
                      data-testid={`volunteer-search-result-${volunteer.id}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={volunteer.profilePhotoUrl || undefined}
                          alt={getVolunteerDisplayName(volunteer)}
                        />
                        <AvatarFallback>
                          {getVolunteerInitials(volunteer)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {getVolunteerDisplayName(volunteer)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {volunteer.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="text-sm text-muted-foreground text-center p-4"
                  data-testid="volunteer-search-no-results"
                >
                  No volunteers found
                </div>
              ))}
          </div>

          {/* Note Field */}
          {selectedVolunteer && (
            <div className="space-y-2">
              <Label htmlFor="note">Admin Note (optional)</Label>
              <Textarea
                id="note"
                placeholder="Add a note about why this volunteer was assigned..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="assign-volunteer-note"
              />
              <p className="text-xs text-muted-foreground">
                This note will be saved with the signup but not sent to the
                volunteer.
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <InfoBox title="Error" variant="red" testId="assign-error">
              <p className="text-red-700">{error}</p>
            </InfoBox>
          )}

          {/* Success Display */}
          {successMessage && (
            <InfoBox title="Success" variant="green" testId="assign-success">
              <p className="text-green-700">{successMessage}</p>
            </InfoBox>
          )}
        </div>

        <ResponsiveDialogFooter
          className="flex gap-2"
          data-testid="assign-volunteer-dialog-footer"
        >
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            data-testid="assign-volunteer-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignVolunteer}
            disabled={isSubmitting || !selectedVolunteer}
            className="min-w-[120px]"
            data-testid="assign-volunteer-confirm-button"
          >
            {isSubmitting ? (
              <span
                className="flex items-center gap-2"
                data-testid="assign-volunteer-loading-text"
              >
                <MotionSpinner className="w-4 h-4" />
                Assigning...
              </span>
            ) : (
              "👥 Assign Volunteer"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
