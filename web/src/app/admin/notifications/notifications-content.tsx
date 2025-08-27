"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Send, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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

interface Volunteer {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  availableLocations: string | null;
  availableDays: string | null;
  receiveShortageNotifications: boolean;
  shortageNotificationTypes: string[];
  _count?: {
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

export function NotificationsContent() {
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [filteredVolunteers, setFilteredVolunteers] = useState<Volunteer[]>([]);
  const [selectedVolunteers, setSelectedVolunteers] = useState<Set<string>>(new Set());
  const [notificationGroups, setNotificationGroups] = useState<NotificationGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filter states
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterShiftType, setFilterShiftType] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<boolean>(false);
  const [filterMinShifts, setFilterMinShifts] = useState<number>(0);
  const [filterNotificationsEnabled, setFilterNotificationsEnabled] = useState<boolean>(true);

  // Email customization
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailMessage, setEmailMessage] = useState<string>("");
  const [useTemplate, setUseTemplate] = useState<boolean>(true);

  // Group saving
  const [groupName, setGroupName] = useState<string>("");
  const [groupDescription, setGroupDescription] = useState<string>("");

  // Load shifts with shortage
  useEffect(() => {
    fetchShifts();
    fetchVolunteers();
    fetchNotificationGroups();
  }, []);

  // Apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [
    volunteers,
    filterLocation,
    filterShiftType,
    filterAvailability,
    filterMinShifts,
    filterNotificationsEnabled,
    selectedShift
  ]);

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
      const response = await fetch("/api/admin/volunteers?includeStats=true");
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

  const applyFilters = () => {
    let filtered = [...volunteers];

    // Filter by notification preferences
    if (filterNotificationsEnabled) {
      filtered = filtered.filter(v => v.receiveShortageNotifications);
    }

    // Filter by location
    if (filterLocation !== "all") {
      filtered = filtered.filter(v => 
        v.availableLocations?.includes(filterLocation)
      );
    }

    // Filter by shift type preference
    if (filterShiftType !== "all") {
      filtered = filtered.filter(v => 
        v.shortageNotificationTypes?.includes(filterShiftType)
      );
    }

    // Filter by availability for selected shift
    if (filterAvailability && selectedShift) {
      const shift = shifts.find(s => s.id === selectedShift);
      if (shift) {
        const shiftDay = format(new Date(shift.start), "EEEE");
        filtered = filtered.filter(v => 
          v.availableDays?.includes(shiftDay)
        );
      }
    }

    // Filter by minimum shifts completed
    if (filterMinShifts > 0) {
      filtered = filtered.filter(v => 
        (v._count?.signups || 0) >= filterMinShifts
      );
    }

    setFilteredVolunteers(filtered);
  };

  const handleSelectAll = () => {
    if (selectedVolunteers.size === filteredVolunteers.length) {
      setSelectedVolunteers(new Set());
    } else {
      setSelectedVolunteers(new Set(filteredVolunteers.map(v => v.id)));
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

  const handleLoadGroup = async () => {
    if (!selectedGroup) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/notification-groups/${selectedGroup}/members`);
      if (!response.ok) throw new Error("Failed to load group");
      
      const data = await response.json();
      const memberIds = data.members.map((m: { userId: string }) => m.userId);
      setSelectedVolunteers(new Set(memberIds));
      
      // Apply group filters if they exist
      const group = notificationGroups.find(g => g.id === selectedGroup);
      if (group?.filters) {
        const filters = group.filters as Record<string, unknown>;
        if (filters.location) setFilterLocation(String(filters.location));
        if (filters.shiftType) setFilterShiftType(String(filters.shiftType));
        if (filters.minShifts !== undefined) setFilterMinShifts(Number(filters.minShifts));
        if (filters.availability !== undefined) setFilterAvailability(Boolean(filters.availability));
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
    if (!selectedShift) {
      toast.error("Please select a shift");
      return;
    }

    if (selectedVolunteers.size === 0) {
      toast.error("Please select at least one volunteer");
      return;
    }

    const shift = shifts.find(s => s.id === selectedShift);
    if (!shift) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/admin/notifications/send-shortage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: selectedShift,
          volunteerIds: Array.from(selectedVolunteers),
          customSubject: !useTemplate ? emailSubject : undefined,
          customMessage: !useTemplate ? emailMessage : undefined,
          groupId: selectedGroup || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to send notifications");
      
      const result = await response.json();
      toast.success(`Successfully sent ${result.sentCount} notifications`);
      
      // Reset selection
      setSelectedVolunteers(new Set());
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
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="send">Send Notifications</TabsTrigger>
        <TabsTrigger value="groups">Manage Groups</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="send" className="space-y-6">
        {notificationGroups.length === 0 && (
          <Alert>
            <AlertDescription>
              💡 <strong>Tip:</strong> After selecting volunteers and applying filters, you can save them as a group in the &quot;Manage Groups&quot; tab for easy reuse later.
            </AlertDescription>
          </Alert>
        )}

        {/* Shift Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Shift with Shortage</CardTitle>
            <CardDescription>
              Choose the shift that needs more volunteers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger>
                <SelectValue placeholder="Select a shift" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((shift) => {
                  const { shortage, percentFilled } = getShiftShortageInfo(shift);
                  return (
                    <SelectItem key={shift.id} value={shift.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {shift.shiftType.name} - {format(new Date(shift.start), "MMM d, h:mm a")}
                        </span>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge variant={shortage > 5 ? "destructive" : "secondary"}>
                            {shortage} needed
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {shift.location}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedShift && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                {(() => {
                  const shift = shifts.find(s => s.id === selectedShift);
                  if (!shift) return null;
                  const { shortage, percentFilled } = getShiftShortageInfo(shift);
                  return (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{shift.shiftType.name}</span>
                        <Badge variant={shortage > 5 ? "destructive" : "secondary"}>
                          {shortage} volunteers needed
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Date: {format(new Date(shift.start), "EEEE, MMMM d, yyyy")}</p>
                        <p>Time: {format(new Date(shift.start), "h:mm a")} - {format(new Date(shift.end), "h:mm a")}</p>
                        <p>Location: {shift.location}</p>
                        <p>Current: {shift._count.signups} / {shift.capacity} ({percentFilled.toFixed(0)}% filled)</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
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
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger id="location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="Wellington">Wellington</SelectItem>
                    <SelectItem value="Glenn Innes">Glenn Innes</SelectItem>
                    <SelectItem value="Onehunga">Onehunga</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="shiftType">Shift Type Preference</Label>
                <Select value={filterShiftType} onValueChange={setFilterShiftType}>
                  <SelectTrigger id="shiftType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="morning">Morning Shift</SelectItem>
                    <SelectItem value="afternoon">Afternoon Shift</SelectItem>
                    <SelectItem value="evening">Evening Shift</SelectItem>
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
                  onChange={(e) => setFilterMinShifts(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="availability"
                  checked={filterAvailability}
                  onCheckedChange={(checked) => setFilterAvailability(checked as boolean)}
                  disabled={!selectedShift}
                />
                <Label htmlFor="availability" className="cursor-pointer">
                  Available on shift day
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications"
                  checked={filterNotificationsEnabled}
                  onCheckedChange={(checked) => setFilterNotificationsEnabled(checked as boolean)}
                />
                <Label htmlFor="notifications" className="cursor-pointer">
                  Notifications enabled only
                </Label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {filteredVolunteers.length} volunteers match filters
              </div>
              
              <div className="flex gap-2">
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={
                      notificationGroups.length === 0 
                        ? "No saved groups" 
                        : "Load saved group"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationGroups.length === 0 ? (
                      <SelectItem value="" disabled>
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
                  disabled={!selectedGroup || isLoading || notificationGroups.length === 0}
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
            <div className="mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedVolunteers.size === filteredVolunteers.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-2">
                {filteredVolunteers.map((volunteer) => (
                  <div
                    key={volunteer.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded-lg cursor-pointer"
                    onClick={() => handleVolunteerToggle(volunteer.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedVolunteers.has(volunteer.id)}
                        onCheckedChange={() => handleVolunteerToggle(volunteer.id)}
                      />
                      <div>
                        <p className="font-medium">
                          {volunteer.name || `${volunteer.firstName} ${volunteer.lastName}`.trim() || volunteer.email}
                        </p>
                        <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {volunteer._count?.signups && (
                        <Badge variant="outline">
                          {volunteer._count.signups} shifts
                        </Badge>
                      )}
                      {volunteer.receiveShortageNotifications ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Email Customization */}
        <Card>
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
            <CardDescription>
              Customize the email message or use the default template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useTemplate"
                checked={useTemplate}
                onCheckedChange={(checked) => setUseTemplate(checked as boolean)}
              />
              <Label htmlFor="useTemplate">Use default template</Label>
            </div>

            {!useTemplate && (
              <>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="We need your help for an upcoming shift"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    placeholder="Enter your custom message..."
                    className="min-h-[150px]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Send Button */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ready to send to {selectedVolunteers.size} volunteers
            </p>
            {selectedShift && (
              <p className="text-xs text-muted-foreground">
                For shift on {format(new Date(shifts.find(s => s.id === selectedShift)?.start || ""), "MMM d, h:mm a")}
              </p>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleSendNotifications}
            disabled={!selectedShift || selectedVolunteers.size === 0 || isSending}
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
                Current selection: {selectedVolunteers.size} volunteers with filters:
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
              disabled={!groupName || selectedVolunteers.size === 0 || isLoading}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Group
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved Groups</CardTitle>
            <CardDescription>
              Manage your notification groups
            </CardDescription>
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
            <CardTitle>Notification History</CardTitle>
            <CardDescription>
              View previously sent shortage notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              Notification history will appear here
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}