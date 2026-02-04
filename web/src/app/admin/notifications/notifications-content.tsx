"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocationPreferenceState } from "@/hooks/use-location-preference";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShiftCalendar } from "@/components/shift-calendar";
import {
  VolunteersDataTable,
  type Volunteer,
} from "@/components/volunteers-data-table";
import { formatInNZT } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { Send, Save, Check, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";

interface Shift {
  id: string;
  shiftType: {
    id: string;
    name: string;
  };
  start: string;
  end: string;
  location: string;
  capacity: number;
  _count: {
    signups: number;
  };
}

interface NotificationGroup {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  memberCount?: number;
}

interface ShiftType {
  id: string;
  name: string;
}

interface NotificationBatch {
  batchKey: string;
  sentAt: string;
  sentBy: string;
  sentByName: string;
  shifts: Array<{
    shiftId: string;
    shiftTypeName: string;
    shiftDate: string;
    shiftLocation: string;
  }>;
  recipients: Array<{
    id: string;
    recipientId: string;
    recipientEmail: string;
    recipientName: string;
    success: boolean;
    errorMessage: string | null;
  }>;
  successCount: number;
  failureCount: number;
  totalCount: number;
}

interface NotificationsContentProps {
  shiftTypes: ShiftType[];
  locations: readonly string[];
}

export function NotificationsContent({
  shiftTypes,
  locations,
}: NotificationsContentProps) {
  const searchParams = useSearchParams();
  const { getLocationPreference, setLocationPreference } =
    useLocationPreferenceState();

  // Multi-shift selection
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());
  const [filterShiftDate, setFilterShiftDate] = useState<Date | undefined>(
    undefined
  );
  const [filterShiftLocation, setFilterShiftLocation] = useState<string>("all");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [filteredVolunteers, setFilteredVolunteers] = useState<Volunteer[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<Set<string>>(
    new Set()
  );
  const [notificationGroups, setNotificationGroups] = useState<
    NotificationGroup[]
  >([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filter states - initialize from localStorage if available
  const [filterLocation, setFilterLocation] = useState<string>(() => {
    const savedLocation = getLocationPreference();
    return savedLocation || "all";
  });
  const [filterShiftType, setFilterShiftType] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<boolean>(false);
  const [filterMinShifts, setFilterMinShifts] = useState<number>(0);
  const [filterNotificationsEnabled, setFilterNotificationsEnabled] =
    useState<boolean>(true);

  // Check for URL parameters to pre-select date, shift type and location
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const shiftTypeParam = searchParams.get("shiftType");
    const locationParam = searchParams.get("location");

    if (dateParam) {
      // Parse the date string (yyyy-MM-dd format)
      const parsedDate = new Date(dateParam + "T00:00:00");
      if (!isNaN(parsedDate.getTime())) {
        setFilterShiftDate(parsedDate);
      }
    }

    if (shiftTypeParam && shiftTypes.some((st) => st.id === shiftTypeParam)) {
      setFilterShiftType(shiftTypeParam);
    }

    if (locationParam && locations.includes(locationParam)) {
      setFilterLocation(locationParam);
      setFilterShiftLocation(locationParam);
    }
  }, [searchParams, shiftTypes, locations]);

  // Save location preference to localStorage when it changes
  useEffect(() => {
    if (filterLocation !== "all") {
      setLocationPreference(filterLocation);
    }
  }, [filterLocation, setLocationPreference]);

  // Auto-select specific shift once shifts are loaded
  useEffect(() => {
    const shiftIdParam = searchParams.get("shiftId");

    if (shifts.length > 0 && shiftIdParam) {
      const targetShift = shifts.find((shift) => shift.id === shiftIdParam);
      if (targetShift) {
        setSelectedShifts(new Set([shiftIdParam]));
        // Set the date filter to the shift's date
        setFilterShiftDate(new Date(targetShift.start));
        setFilterShiftLocation(targetShift.location || "all");
      }
    }
  }, [shifts, searchParams]);

  // Group saving
  const [groupName, setGroupName] = useState<string>("");
  const [groupDescription, setGroupDescription] = useState<string>("");

  // Notification history
  const [notificationHistory, setNotificationHistory] = useState<NotificationBatch[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const fetchShifts = async () => {
    try {
      const response = await fetch("/api/admin/shifts/shortages");
      if (!response.ok) throw new Error("Failed to fetch shifts");
      const data = await response.json();
      setShifts(data);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error("Failed to load shifts");
    }
  };

  const fetchVolunteers = async () => {
    try {
      const response = await fetch("/api/admin/volunteers?includeStats=true&includeAdmins=true");
      if (!response.ok) throw new Error("Failed to fetch volunteers");
      const data = await response.json();
      setVolunteers(data);
    } catch (error) {
      console.error("Error fetching volunteers:", error);
      toast.error("Failed to load volunteers");
    }
  };

  const fetchNotificationGroups = async () => {
    try {
      const response = await fetch("/api/admin/notification-groups");
      if (!response.ok) throw new Error("Failed to fetch notification groups");
      const data = await response.json();
      setNotificationGroups(data);
    } catch (error) {
      console.error("Error fetching notification groups:", error);
    }
  };

  const fetchNotificationHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/admin/notifications/history?limit=100");
      if (!response.ok) throw new Error("Failed to fetch notification history");
      const data = await response.json();
      setNotificationHistory(data.batches);
    } catch (error) {
      console.error("Error fetching notification history:", error);
      toast.error("Failed to load notification history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filter shifts based on date and location
  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      // Filter by date - compare as formatted strings in NZT to avoid timezone issues
      if (filterShiftDate) {
        const shiftDateStr = formatInNZT(new Date(shift.start), "yyyy-MM-dd");
        const filterDateStr = formatInNZT(filterShiftDate, "yyyy-MM-dd");
        if (shiftDateStr !== filterDateStr) {
          return false;
        }
      }

      // Filter by location
      if (filterShiftLocation !== "all" && shift.location !== filterShiftLocation) {
        return false;
      }

      return true;
    });
  }, [shifts, filterShiftDate, filterShiftLocation]);

  // Build shift summaries for the calendar component
  const shiftSummaries = useMemo(() => {
    const summariesMap = new Map<
      string,
      {
        count: number;
        totalCapacity: number;
        totalConfirmed: number;
        locations: string[];
      }
    >();

    shifts.forEach((shift) => {
      const dateKey = formatInNZT(new Date(shift.start), "yyyy-MM-dd");
      const location = shift.location || "Unknown";

      if (!summariesMap.has(dateKey)) {
        summariesMap.set(dateKey, {
          count: 0,
          totalCapacity: 0,
          totalConfirmed: 0,
          // Include "all" so calendar shows dots when no location is selected
          locations: ["all"],
        });
      }

      const summary = summariesMap.get(dateKey)!;
      summary.count++;
      summary.totalCapacity += shift.capacity;
      summary.totalConfirmed += shift._count.signups;

      if (!summary.locations.includes(location)) {
        summary.locations.push(location);
      }
    });

    return Array.from(summariesMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }, [shifts]);

  const applyFilters = useCallback(() => {
    let filtered = [...volunteers];

    // Filter by notification preferences
    if (filterNotificationsEnabled) {
      filtered = filtered.filter(
        (v) => v.receiveShortageNotifications === true
      );
    }

    // Filter by location
    if (filterLocation !== "all") {
      filtered = filtered.filter(
        (v) =>
          Array.isArray(v.availableLocations) &&
          v.availableLocations.includes(filterLocation)
      );
    }

    // Filter by shift type preference
    if (filterShiftType !== "all") {
      filtered = filtered.filter(
        (v) =>
          Array.isArray(v.excludedShortageNotificationTypes) &&
          !v.excludedShortageNotificationTypes.includes(filterShiftType)
      );
    }

    // Filter by availability for selected shifts
    if (filterAvailability && selectedShifts.size > 0) {
      // Get all days from selected shifts
      const selectedShiftDays = new Set<string>();
      selectedShifts.forEach((shiftId) => {
        const shift = shifts.find((s) => s.id === shiftId);
        if (shift) {
          selectedShiftDays.add(formatInNZT(new Date(shift.start), "EEEE"));
        }
      });

      filtered = filtered.filter(
        (v) =>
          Array.isArray(v.availableDays) &&
          [...selectedShiftDays].some((day) => v.availableDays?.includes(day))
      );
    }

    // Filter by minimum shifts completed
    if (filterMinShifts > 0) {
      filtered = filtered.filter(
        (v) => (v._count?.signups || 0) >= filterMinShifts
      );
    }

    setFilteredVolunteers(filtered);
  }, [
    volunteers,
    filterNotificationsEnabled,
    filterLocation,
    filterShiftType,
    filterAvailability,
    selectedShifts,
    shifts,
    filterMinShifts,
  ]);

  // Load shifts with shortage
  useEffect(() => {
    fetchShifts();
    fetchVolunteers();
    fetchNotificationGroups();
    fetchNotificationHistory();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [
    applyFilters,
    volunteers,
    filterLocation,
    filterShiftType,
    filterAvailability,
    filterMinShifts,
    filterNotificationsEnabled,
    selectedShifts,
  ]);

  const handleSelectAll = () => {
    if (selectedVolunteers.size === filteredVolunteers.length) {
      setSelectedVolunteers(new Set());
    } else {
      setSelectedVolunteers(new Set(filteredVolunteers.map((v) => v.id)));
    }
  };

  const handleVolunteerToggle = (volunteerId: string) => {
    const newSelection = new Set(selectedVolunteers);
    if (newSelection.has(volunteerId)) {
      newSelection.delete(volunteerId);
    } else {
      newSelection.add(volunteerId);
    }
    setSelectedVolunteers(newSelection);
  };

  const handleBatchToggle = (volunteerIds: string[], shouldSelect: boolean) => {
    const newSelection = new Set(selectedVolunteers);
    volunteerIds.forEach((id) => {
      if (shouldSelect) {
        newSelection.add(id);
      } else {
        newSelection.delete(id);
      }
    });
    setSelectedVolunteers(newSelection);
  };

  const handleShiftToggle = (shiftId: string) => {
    const newSelection = new Set(selectedShifts);
    if (newSelection.has(shiftId)) {
      newSelection.delete(shiftId);
    } else {
      newSelection.add(shiftId);
    }
    setSelectedShifts(newSelection);
  };

  const handleSelectAllShifts = () => {
    if (selectedShifts.size === filteredShifts.length) {
      setSelectedShifts(new Set());
    } else {
      setSelectedShifts(new Set(filteredShifts.map((s) => s.id)));
    }
  };

  const handleCalendarDateSelect = (date: Date) => {
    setFilterShiftDate(date);
    // Clear shift selection when date changes
    setSelectedShifts(new Set());
  };

  const handleLoadGroup = async () => {
    if (!selectedGroup) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/notification-groups/${selectedGroup}/members`
      );
      if (!response.ok) throw new Error("Failed to load group");

      const data = await response.json();
      const memberIds = data.members.map((m: { userId: string }) => m.userId);
      setSelectedVolunteers(new Set(memberIds));

      // Apply group filters if they exist
      const group = notificationGroups.find((g) => g.id === selectedGroup);
      if (group?.filters) {
        const filters = group.filters as Record<string, unknown>;
        if (filters.location) setFilterLocation(String(filters.location));
        if (filters.shiftType) setFilterShiftType(String(filters.shiftType));
        if (filters.minShifts !== undefined)
          setFilterMinShifts(Number(filters.minShifts));
        if (filters.availability !== undefined)
          setFilterAvailability(Boolean(filters.availability));
      }

      toast.success(`Loaded ${memberIds.length} volunteers from group`);
    } catch (error) {
      console.error("Error loading group:", error);
      toast.error("Failed to load group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!groupName || selectedVolunteers.size === 0) {
      toast.error("Please provide a group name and select volunteers");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/notification-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          description: groupDescription,
          filters: {
            location: filterLocation,
            shiftType: filterShiftType,
            minShifts: filterMinShifts,
            availability: filterAvailability,
            notificationsEnabled: filterNotificationsEnabled,
          },
          memberIds: Array.from(selectedVolunteers),
        }),
      });

      if (!response.ok) throw new Error("Failed to save group");

      const newGroup = await response.json();
      setNotificationGroups([...notificationGroups, newGroup]);
      setGroupName("");
      setGroupDescription("");
      toast.success("Group saved successfully");
    } catch (error) {
      console.error("Error saving group:", error);
      toast.error("Failed to save group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendNotifications = async () => {
    if (selectedShifts.size === 0) {
      toast.error("Please select at least one shift");
      return;
    }

    if (selectedVolunteers.size === 0) {
      toast.error("Please select at least one volunteer");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/admin/notifications/send-shortage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftIds: Array.from(selectedShifts),
          volunteerIds: Array.from(selectedVolunteers),
          groupId: selectedGroup || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send notifications");

      const result = await response.json();
      toast.success(
        `Successfully sent ${result.sentCount} emails for ${result.shiftsCount} shift(s) to ${result.volunteersCount} volunteer(s)`
      );

      // Reset selection
      setSelectedVolunteers(new Set());
      setSelectedShifts(new Set());

      // Refresh notification history
      fetchNotificationHistory();
    } catch (error) {
      console.error("Error sending notifications:", error);
      toast.error("Failed to send notifications");
    } finally {
      setIsSending(false);
    }
  };

  const getShiftShortageInfo = (shift: Shift) => {
    const shortage = shift.capacity - shift._count.signups;
    const percentFilled = (shift._count.signups / shift.capacity) * 100;
    return { shortage, percentFilled };
  };

  return (
    <Tabs defaultValue="send" className="w-full">
      <ScrollableTabsList>
        <TabsTrigger value="send">Send Notifications</TabsTrigger>
        <TabsTrigger value="groups">Manage Groups</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </ScrollableTabsList>

      <TabsContent value="send" className="space-y-6">
        {notificationGroups.length === 0 && (
          <Alert>
            <AlertDescription>
              💡 <strong>Tip:</strong> After selecting volunteers and applying
              filters, you can save them as a group in the &quot;Manage
              Groups&quot; tab for easy reuse later.
            </AlertDescription>
          </Alert>
        )}

        {/* Shift Selection */}
        <Card data-testid="shift-filter-section">
          <CardHeader>
            <CardTitle>Select Shifts with Shortage</CardTitle>
            <CardDescription>
              Choose the date and location to filter shifts, then select the
              shifts that need volunteers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date and Location Filters */}
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label className="mb-2 block">Date</Label>
                <ShiftCalendar
                  selectedDate={filterShiftDate || new Date()}
                  selectedLocation={filterShiftLocation}
                  shiftSummaries={shiftSummaries}
                  onDateSelect={handleCalendarDateSelect}
                />
              </div>

              <div className="flex-1 min-w-[200px]">
                <Label>Location</Label>
                <Select
                  value={filterShiftLocation}
                  onValueChange={(value) => {
                    setFilterShiftLocation(value);
                    // Clear shift selection when location changes
                    setSelectedShifts(new Set());
                  }}
                >
                  <SelectTrigger data-testid="shift-location-filter" className="h-11">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Shift List */}
            {filterShiftDate && filterShiftLocation !== "all" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Shifts{" "}
                  {filteredShifts.length > 0 && `(${filteredShifts.length})`}
                </Label>
                {filteredShifts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllShifts}
                    data-testid="shift-select-all-button"
                  >
                    {selectedShifts.size === filteredShifts.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                )}
              </div>

              {filteredShifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No shifts with shortages found for this date and location
                </div>
              ) : (
                <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                  {filteredShifts.map((shift) => {
                    const { shortage, percentFilled } =
                      getShiftShortageInfo(shift);
                    const isSelected = selectedShifts.has(shift.id);
                    return (
                      <div
                        key={shift.id}
                        className={cn(
                          "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          isSelected && "bg-muted"
                        )}
                        onClick={() => handleShiftToggle(shift.id)}
                        data-testid={`shift-checkbox-${shift.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleShiftToggle(shift.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {shift.shiftType.name}
                            </span>
                            <Badge
                              variant={
                                shortage > 5 ? "destructive" : "secondary"
                              }
                            >
                              {shortage} needed
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatInNZT(new Date(shift.start), "h:mm a")} -{" "}
                            {formatInNZT(new Date(shift.end), "h:mm a")} •{" "}
                            {shift.location} • {shift._count.signups}/
                            {shift.capacity} ({percentFilled.toFixed(0)}%)
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Shifts Summary */}
              {selectedShifts.size > 0 && (
                <div
                  className="p-3 bg-muted rounded-md"
                  data-testid="selected-shifts-count"
                >
                  <span className="font-medium">
                    {selectedShifts.size} shift(s) selected
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({Array.from(selectedShifts)
                      .map((id) => {
                        const shift = shifts.find((s) => s.id === id);
                        return shift?.shiftType.name;
                      })
                      .filter(Boolean)
                      .join(", ")})
                  </span>
                </div>
              )}
            </div>
            )}

            {/* Prompt to select date and location */}
            {(!filterShiftDate || filterShiftLocation === "all") && (
              <div className="text-center py-8 text-muted-foreground border rounded-md">
                Please select a date and location to view available shifts
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card data-testid="volunteer-filter-section">
          <CardHeader>
            <CardTitle>Filter Volunteers</CardTitle>
            <CardDescription>
              Select which volunteers should receive the notification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Select
                  value={filterLocation}
                  onValueChange={setFilterLocation}
                >
                  <SelectTrigger id="location" data-testid="location-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="shiftType">Shift Type Preference</Label>
                <Select
                  value={filterShiftType}
                  onValueChange={setFilterShiftType}
                >
                  <SelectTrigger id="shiftType" data-testid="shift-type-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {shiftTypes.map((shiftType) => (
                      <SelectItem key={shiftType.id} value={shiftType.id}>
                        {shiftType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="minShifts">Min. Shifts Completed</Label>
                <Input
                  id="minShifts"
                  type="number"
                  min="0"
                  value={filterMinShifts}
                  onChange={(e) =>
                    setFilterMinShifts(parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="availability"
                  checked={filterAvailability}
                  onCheckedChange={(checked) =>
                    setFilterAvailability(checked as boolean)
                  }
                  disabled={selectedShifts.size === 0}
                  data-testid="availability-filter"
                />
                <Label htmlFor="availability" className="cursor-pointer">
                  Available on shift day(s)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications"
                  checked={filterNotificationsEnabled}
                  onCheckedChange={(checked) =>
                    setFilterNotificationsEnabled(checked as boolean)
                  }
                  data-testid="notification-filter-toggle"
                />
                <Label htmlFor="notifications" className="cursor-pointer">
                  Notifications enabled only
                </Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div
                className="text-sm text-muted-foreground"
                data-testid="volunteer-count"
              >
                {filteredVolunteers.length} volunteers match filters
              </div>

              <div className="flex gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue
                      placeholder={
                        notificationGroups.length === 0
                          ? "No saved groups"
                          : "Load saved group"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationGroups.length === 0 ? (
                      <SelectItem value="no-groups" disabled>
                        No saved groups available
                      </SelectItem>
                    ) : (
                      notificationGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleLoadGroup}
                  disabled={
                    !selectedGroup ||
                    isLoading ||
                    notificationGroups.length === 0
                  }
                >
                  Load Group
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volunteer Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Recipients</CardTitle>
            <CardDescription>
              {selectedVolunteers.size} volunteers selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VolunteersDataTable
              volunteers={filteredVolunteers}
              selectedVolunteers={selectedVolunteers}
              onVolunteerToggle={handleVolunteerToggle}
              onSelectAll={handleSelectAll}
              onBatchToggle={handleBatchToggle}
              onSelectAllRows={handleSelectAll}
            />
          </CardContent>
        </Card>

        {/* Send Button */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ready to send to {selectedVolunteers.size} volunteers for{" "}
              {selectedShifts.size} shift(s)
            </p>
            {selectedShifts.size > 0 && (
              <p className="text-xs text-muted-foreground">
                Total emails: {selectedVolunteers.size * selectedShifts.size}{" "}
                (one email per shift per volunteer)
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <EmailPreviewDialog
              emailType="shortage"
              triggerLabel="Preview Email"
              triggerVariant="outline"
            />
            <Button
              size="lg"
              onClick={handleSendNotifications}
              disabled={
                selectedShifts.size === 0 ||
                selectedVolunteers.size === 0 ||
                isSending
              }
            >
              {isSending ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Notifications
                </>
              )}
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="groups" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Save Current Selection as Group</CardTitle>
            <CardDescription>
              Save the current filters and selection for future use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Weekend Warriors, Kitchen Volunteers"
              />
            </div>

            <div>
              <Label htmlFor="groupDescription">Description</Label>
              <Textarea
                id="groupDescription"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Describe this group..."
              />
            </div>

            <Alert>
              <AlertDescription>
                Current selection: {selectedVolunteers.size} volunteers with
                filters:
                <ul className="mt-2 text-sm list-disc list-inside">
                  <li>Location: {filterLocation}</li>
                  <li>Shift Type: {filterShiftType}</li>
                  <li>Min Shifts: {filterMinShifts}</li>
                  <li>Available on day: {filterAvailability ? "Yes" : "No"}</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleSaveGroup}
              disabled={
                !groupName || selectedVolunteers.size === 0 || isLoading
              }
            >
              <Save className="mr-2 h-4 w-4" />
              Save Group
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Groups</CardTitle>
            <CardDescription>Manage your notification groups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {notificationGroups.map((group) => (
                <div key={group.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {group.description}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        {group.memberCount || 0} members
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGroup(group.id);
                        handleLoadGroup();
                      }}
                    >
                      Load
                    </Button>
                  </div>
                </div>
              ))}

              {notificationGroups.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No saved groups yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notification History</CardTitle>
                <CardDescription>
                  View previously sent shortage notifications
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchNotificationHistory}
                disabled={isLoadingHistory}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingHistory && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                Loading history...
              </div>
            ) : notificationHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No notifications have been sent yet
              </p>
            ) : (
              <div className="space-y-4">
                {notificationHistory.map((batch) => (
                  <div
                    key={batch.batchKey}
                    className="border rounded-lg overflow-hidden"
                  >
                    <button
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                      onClick={() =>
                        setExpandedBatch(
                          expandedBatch === batch.batchKey ? null : batch.batchKey
                        )
                      }
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {formatInNZT(new Date(batch.sentAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          <Badge variant="outline">
                            {batch.shifts.length} shift{batch.shifts.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Sent by {batch.sentByName} to {batch.totalCount} recipient
                          {batch.totalCount !== 1 ? "s" : ""}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          {batch.successCount > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              {batch.successCount} sent
                            </span>
                          )}
                          {batch.failureCount > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              {batch.failureCount} failed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground">
                        {expandedBatch === batch.batchKey ? "▲" : "▼"}
                      </div>
                    </button>

                    {expandedBatch === batch.batchKey && (
                      <div className="border-t bg-muted/30 p-4 space-y-4">
                        {/* Shifts */}
                        <div>
                          <h4 className="font-medium text-sm mb-2">Shifts</h4>
                          <div className="space-y-1">
                            {batch.shifts.map((shift) => (
                              <div
                                key={shift.shiftId}
                                className="text-sm flex items-center gap-2"
                              >
                                <Badge variant="secondary">{shift.shiftTypeName}</Badge>
                                <span className="text-muted-foreground">
                                  {formatInNZT(new Date(shift.shiftDate), "EEE, MMM d")} at {shift.shiftLocation}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recipients */}
                        <div>
                          <h4 className="font-medium text-sm mb-2">Recipients</h4>
                          <div className="max-h-[200px] overflow-y-auto space-y-1">
                            {batch.recipients.map((recipient) => (
                              <div
                                key={recipient.id}
                                className="text-sm flex items-center justify-between py-1"
                              >
                                <div className="flex items-center gap-2">
                                  {recipient.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )}
                                  <span>{recipient.recipientName}</span>
                                  <span className="text-muted-foreground">
                                    ({recipient.recipientEmail})
                                  </span>
                                </div>
                                {recipient.errorMessage && (
                                  <span className="text-red-600 text-xs">
                                    {recipient.errorMessage}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
