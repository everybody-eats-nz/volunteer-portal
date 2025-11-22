"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Save, Loader2, Plus, Edit } from "lucide-react";
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
  locations: Location[];
}

export function LocationSettingsForm({ locations: initialLocations }: LocationSettingsFormProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [locationValues, setLocationValues] = useState<Record<string, number>>(
    initialLocations.reduce((acc, loc) => {
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
        setLocations((prev) => [...prev, createdLocation]);
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
        setLocations((prev) =>
          prev.map((loc) => (loc.id === updatedLocation.id ? updatedLocation : loc))
        );
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {locations.map((location) => (
        <Card key={location.id}>
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
            </div>
          </CardContent>
        </Card>
      ))}

        {locations.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No locations found. Click &quot;Add Location&quot; to create your first location.</p>
            </CardContent>
          </Card>
        )}
      </div>

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
