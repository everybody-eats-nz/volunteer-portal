"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type FlexibleSignup = {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    volunteerGrade: string;
    profilePhotoUrl: string | null;
  };
  shift: {
    id: string;
    start: string;
    end: string;
    location: string | null;
    capacity: number;
    shiftType: {
      id: string;
      name: string;
    };
  };
};

type AvailableShift = {
  id: string;
  start: string;
  end: string;
  location: string | null;
  capacity: number;
  confirmedCount: number;
  shiftType: {
    id: string;
    name: string;
  };
};

interface FlexiblePlacementManagerProps {
  selectedDate: string;
  selectedLocation: string;
  flexibleSignups: FlexibleSignup[];
}

export function FlexiblePlacementManager({ selectedDate, selectedLocation, flexibleSignups: initialFlexibleSignups }: FlexiblePlacementManagerProps) {
  const [flexibleSignups, setFlexibleSignups] = useState<FlexibleSignup[]>(initialFlexibleSignups);
  const [availableShifts, setAvailableShifts] = useState<AvailableShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [selectedSignup, setSelectedSignup] = useState<FlexibleSignup | null>(null);
  const [selectedTargetShift, setSelectedTargetShift] = useState<string>("");
  const [placementNotes, setPlacementNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  // Update flexible signups when props change
  useEffect(() => {
    setFlexibleSignups(initialFlexibleSignups);
  }, [initialFlexibleSignups]);

  const fetchAvailableShifts = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/shifts/available?date=${selectedDate}&location=${selectedLocation}`);
      if (response.ok) {
        const data = await response.json();
        // Filter out the flexible shift itself and only show PM shifts (after 4pm)
        const pmShifts = data.filter((shift: AvailableShift) => {
          const shiftStart = new Date(shift.start);
          const hour = shiftStart.getHours();
          return hour >= 16 && shift.shiftType.name !== "Anywhere I'm Needed (PM)";
        });
        setAvailableShifts(pmShifts);
      }
    } catch (error) {
      console.error("Error fetching available shifts:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedLocation]);

  useEffect(() => {
    fetchAvailableShifts();
  }, [fetchAvailableShifts]);

  const handlePlaceVolunteer = async () => {
    if (!selectedSignup || !selectedTargetShift) return;

    setPlacing(true);
    try {
      const response = await fetch("/api/admin/flexible-placements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signupId: selectedSignup.id,
          targetShiftId: selectedTargetShift,
          placementNotes: placementNotes || undefined,
        }),
      });

      if (response.ok) {
        toast.success(`${selectedSignup.user.firstName} has been placed successfully!`);
        setPlacementDialogOpen(false);
        setSelectedSignup(null);
        setSelectedTargetShift("");
        setPlacementNotes("");
        
        // Remove the placed volunteer from the local state
        setFlexibleSignups(prev => prev.filter(signup => signup.id !== selectedSignup.id));
        fetchAvailableShifts();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to place volunteer");
      }
    } catch (error) {
      console.error("Error placing volunteer:", error);
      toast.error("Failed to place volunteer");
    } finally {
      setPlacing(false);
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "GREEN": return "bg-green-100 text-green-800";
      case "YELLOW": return "bg-yellow-100 text-yellow-800";
      case "PINK": return "bg-pink-100 text-pink-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case "GREEN": return "Standard";
      case "YELLOW": return "Experienced";
      case "PINK": return "Shift Leader";
      default: return grade;
    }
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Flexible Placements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading flexible signups...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (flexibleSignups.length === 0) {
    return null; // Don't show the component if there are no flexible signups
  }

  return (
    <Card className="mt-6 border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <ArrowRight className="h-5 w-5" />
          {flexibleSignups[0]?.shift.shiftType.name}
        </CardTitle>
        <p className="text-sm text-orange-600">
          {flexibleSignups.length} volunteer{flexibleSignups.length !== 1 ? 's' : ''} signed up for &quot;Anywhere I&apos;m Needed&quot; and need to be placed
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {flexibleSignups.map((signup) => (
          <div key={signup.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-200">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={signup.user.profilePhotoUrl || undefined} />
                <AvatarFallback>
                  {signup.user.firstName?.[0]}{signup.user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{signup.user.name || `${signup.user.firstName} ${signup.user.lastName}`}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge className={getGradeColor(signup.user.volunteerGrade)}>
                    {getGradeLabel(signup.user.volunteerGrade)}
                  </Badge>
                  <span>•</span>
                  <span>Signed up {format(new Date(signup.createdAt), "MMM d 'at' h:mm a")}</span>
                </div>
              </div>
            </div>
            <Dialog open={placementDialogOpen && selectedSignup?.id === signup.id} onOpenChange={(open) => {
              if (!open) {
                setPlacementDialogOpen(false);
                setSelectedSignup(null);
                setSelectedTargetShift("");
                setPlacementNotes("");
              }
            }}>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  onClick={() => {
                    setSelectedSignup(signup);
                    setPlacementDialogOpen(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Place Volunteer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Place {signup.user.firstName} in PM Shift</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="targetShift">Select PM Shift</Label>
                    <Select value={selectedTargetShift} onValueChange={setSelectedTargetShift}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a shift..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableShifts.map(shift => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.shiftType.name} • {format(new Date(shift.start), "h:mm a")} - {format(new Date(shift.end), "h:mm a")} • {shift.capacity - shift.confirmedCount} spots available
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="placementNotes">Placement Notes (optional)</Label>
                    <Textarea
                      id="placementNotes"
                      value={placementNotes}
                      onChange={(e) => setPlacementNotes(e.target.value)}
                      placeholder="Add any notes about this placement..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setPlacementDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handlePlaceVolunteer}
                      disabled={!selectedTargetShift || placing}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {placing ? "Placing..." : "Place Volunteer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}