"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Save, Loader2, Plus, Edit, Archive, ArchiveRestore, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Location {
  id: string;
  name: string;
  address: string;
  defaultMealsServed: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LocationSettingsFormProps {
  activeLocations: Location[];
  inactiveLocations: Location[];
}

interface DisableLocationDialogProps {
  locationId: string;
  locationName: string;
  onDisable: (locationId: string) => Promise<void>;
  children: React.ReactNode;
}

function DisableLocationDialog({
  locationId,
  locationName,
  onDisable,
  children,
}: DisableLocationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const handleDisable = async () => {
    setIsDisabling(true);
    try {
      await onDisable(locationId);
      setOpen(false);
    } catch (error) {
      console.error("Failed to disable location:", error);
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="disable-location-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Archive className="h-5 w-5" />
            Disable Location
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to disable this location? It will be hidden from dropdowns when creating new shifts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Details */}
          <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="font-medium">{locationName}</span>
            </div>
          </div>

          {/* Info alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>Any upcoming shifts at this location will remain active.</p>
                <p className="text-sm">Disabled locations can be re-enabled at any time from the &ldquo;Disabled Locations&rdquo; section.</p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDisabling}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisable}
            disabled={isDisabling}
            data-testid="disable-location-confirm-button"
          >
            {isDisabling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Disabling...
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Disable Location
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LocationSettingsForm({
  activeLocations: initialActiveLocations,
  inactiveLocations: initialInactiveLocations
}: LocationSettingsFormProps) {
  const [activeLocations, setActiveLocations] = useState(initialActiveLocations);
  const [inactiveLocations, setInactiveLocations] = useState(initialInactiveLocations);
  const [locationValues, setLocationValues] = useState<Record<string, number>>(
    [...initialActiveLocations, ...initialInactiveLocations].reduce((acc, loc) => {
      acc[loc.id] = loc.defaultMealsServed;
      return acc;
    }, {} as Record<string, number>)
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    defaultMealsServed: 60,
  });
  const [creating, setCreating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editing, setEditing] = useState(false);
  const [activeOpen, setActiveOpen] = useState(true);
  const [inactiveOpen, setInactiveOpen] = useState(false);

  const handleSave = async (locationId: string) => {
    setSaving((prev) => ({ ...prev, [locationId]: true }));

    try {
      const response = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: locationId,
          defaultMealsServed: locationValues[locationId],
        }),
      });

      if (response.ok) {
        toast.success("Location settings updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update location settings");
      }
    } catch (error) {
      console.error("Error updating location:", error);
      toast.error("Failed to update location settings");
    } finally {
      setSaving((prev) => ({ ...prev, [locationId]: false }));
    }
  };

  const handleDisableLocation = async (locationId: string) => {
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Move location from active to inactive
        const location = activeLocations.find(loc => loc.id === locationId);
        if (location) {
          setActiveLocations(prev => prev.filter(loc => loc.id !== locationId));
          setInactiveLocations(prev => [...prev, { ...location, isActive: false }]);
        }

        toast.success(`Location disabled successfully${data.upcomingShifts > 0 ? ` (${data.upcomingShifts} upcoming shifts remain active)` : ""}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to disable location");
      }
    } catch (error) {
      console.error("Error disabling location:", error);
      toast.error("Failed to disable location");
    }
  };

  const handleEnableLocation = async (locationId: string) => {
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const updatedLocation = await response.json();

        // Move location from inactive to active
        setInactiveLocations(prev => prev.filter(loc => loc.id !== locationId));
        setActiveLocations(prev => [...prev, updatedLocation].sort((a, b) => a.name.localeCompare(b.name)));

        toast.success("Location re-enabled successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to re-enable location");
      }
    } catch (error) {
      console.error("Error re-enabling location:", error);
      toast.error("Failed to re-enable location");
    }
  };

  const handleCreateLocation = async () => {
    if (!newLocation.name || !newLocation.address) {
      toast.error("Please fill in all fields");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newLocation),
      });

      if (response.ok) {
        const createdLocation = await response.json();
        setActiveLocations((prev) => [...prev, createdLocation].sort((a, b) => a.name.localeCompare(b.name)));
        setLocationValues((prev) => ({
          ...prev,
          [createdLocation.id]: createdLocation.defaultMealsServed,
        }));
        setNewLocation({ name: "", address: "", defaultMealsServed: 60 });
        setDialogOpen(false);
        toast.success("Location created successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create location");
      }
    } catch (error) {
      console.error("Error creating location:", error);
      toast.error("Failed to create location");
    } finally {
      setCreating(false);
    }
  };

  const handleEditLocation = async () => {
    if (!editingLocation || !editingLocation.name || !editingLocation.address) {
      toast.error("Please fill in all fields");
      return;
    }

    setEditing(true);
    try {
      const response = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingLocation.id,
          name: editingLocation.name,
          address: editingLocation.address,
          defaultMealsServed: editingLocation.defaultMealsServed,
        }),
      });

      if (response.ok) {
        const updatedLocation = await response.json();

        // Update in the appropriate list
        if (editingLocation.isActive) {
          setActiveLocations((prev) =>
            prev.map((loc) => (loc.id === updatedLocation.id ? updatedLocation : loc))
          );
        } else {
          setInactiveLocations((prev) =>
            prev.map((loc) => (loc.id === updatedLocation.id ? updatedLocation : loc))
          );
        }

        setLocationValues((prev) => ({
          ...prev,
          [updatedLocation.id]: updatedLocation.defaultMealsServed,
        }));
        setEditDialogOpen(false);
        setEditingLocation(null);
        toast.success("Location updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update location");
      }
    } catch (error) {
      console.error("Error updating location:", error);
      toast.error("Failed to update location");
    } finally {
      setEditing(false);
    }
  };

  const renderLocationCard = (location: Location, isActive: boolean) => (
    <Card key={location.id} className={!isActive ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {location.name}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {location.address}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingLocation(location);
              setEditDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor={`default-meals-${location.id}`}>
              Default Meals Served Per Day
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              This value will be pre-filled when recording daily attendance
            </p>
            <div className="flex gap-2">
              <Input
                id={`default-meals-${location.id}`}
                type="number"
                min="0"
                value={locationValues[location.id] || ""}
                onChange={(e) =>
                  setLocationValues((prev) => ({
                    ...prev,
                    [location.id]: parseInt(e.target.value) || 0,
                  }))
                }
                className="flex-1"
              />
              <Button
                onClick={() => handleSave(location.id)}
                disabled={saving[location.id]}
                size="sm"
              >
                {saving[location.id] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Disable/Enable button */}
          {isActive ? (
            <DisableLocationDialog
              locationId={location.id}
              locationName={location.name}
              onDisable={handleDisableLocation}
            >
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                data-testid={`disable-location-button-${location.id}`}
              >
                <Archive className="h-4 w-4 mr-2" />
                Disable Location
              </Button>
            </DisableLocationDialog>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => handleEnableLocation(location.id)}
              data-testid={`enable-location-button-${location.id}`}
            >
              <ArchiveRestore className="h-4 w-4 mr-2" />
              Re-enable Location
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Restaurant Locations</h2>
          <p className="text-muted-foreground">
            Manage your restaurant locations and default meal counts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>
                Create a new restaurant location with default settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="new-name">Location Name</Label>
                <Input
                  id="new-name"
                  value={newLocation.name}
                  onChange={(e) =>
                    setNewLocation((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Auckland Central"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="new-address">Address</Label>
                <Input
                  id="new-address"
                  value={newLocation.address}
                  onChange={(e) =>
                    setNewLocation((prev) => ({ ...prev, address: e.target.value }))
                  }
                  placeholder="123 Main Street, Auckland, New Zealand"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="new-default-meals">Default Meals Served</Label>
                <Input
                  id="new-default-meals"
                  type="number"
                  min="0"
                  value={newLocation.defaultMealsServed}
                  onChange={(e) =>
                    setNewLocation((prev) => ({
                      ...prev,
                      defaultMealsServed: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateLocation} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Location"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Locations Section */}
      <Collapsible open={activeOpen} onOpenChange={setActiveOpen}>
        <div className="space-y-4">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
              data-testid="active-locations-section"
            >
              <div className="flex items-center gap-2">
                {activeOpen ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <h3 className="text-lg font-semibold">
                  Active Locations ({activeLocations.length})
                </h3>
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-2">
              {activeLocations.map((location) => renderLocationCard(location, true))}

              {activeLocations.length === 0 && (
                <Card className="md:col-span-2 lg:col-span-3">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active locations found. Click &quot;Add Location&quot; to create your first location.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Disabled Locations Section */}
      {inactiveLocations.length > 0 && (
        <Collapsible open={inactiveOpen} onOpenChange={setInactiveOpen}>
          <div className="space-y-4">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
                data-testid="inactive-locations-section"
              >
                <div className="flex items-center gap-2">
                  {inactiveOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <h3 className="text-lg font-semibold text-muted-foreground">
                    Disabled Locations ({inactiveLocations.length})
                  </h3>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pt-2">
                {inactiveLocations.map((location) => renderLocationCard(location, false))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Edit Location Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update the location details and settings
            </DialogDescription>
          </DialogHeader>
          {editingLocation && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name">Location Name</Label>
                <Input
                  id="edit-name"
                  value={editingLocation.name}
                  onChange={(e) =>
                    setEditingLocation((prev) =>
                      prev ? { ...prev, name: e.target.value } : null
                    )
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editingLocation.address}
                  onChange={(e) =>
                    setEditingLocation((prev) =>
                      prev ? { ...prev, address: e.target.value } : null
                    )
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-default-meals">Default Meals Served</Label>
                <Input
                  id="edit-default-meals"
                  type="number"
                  min="0"
                  value={editingLocation.defaultMealsServed}
                  onChange={(e) =>
                    setEditingLocation((prev) =>
                      prev
                        ? {
                            ...prev,
                            defaultMealsServed: parseInt(e.target.value) || 0,
                          }
                        : null
                    )
                  }
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingLocation(null);
              }}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button onClick={handleEditLocation} disabled={editing}>
              {editing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
