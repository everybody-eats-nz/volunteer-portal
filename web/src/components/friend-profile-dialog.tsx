"use client";

import { useState, useEffect } from "react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Trophy, 
  CalendarDays
} from "lucide-react";

interface Friend {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  friendsSince: string;
}

interface FriendShift {
  id: string;
  start: string;
  end: string;
  location: string | null;
  shiftType: {
    name: string;
    description: string | null;
  };
  status: string;
}

interface FriendAchievement {
  id: string;
  unlockedAt: string;
  achievement: {
    name: string;
    description: string;
    icon: string;
    category: string;
    points: number;
  };
}

interface FriendProfile {
  shifts: FriendShift[];
  achievements: FriendAchievement[];
  totalShifts: number;
  totalHours: number;
}

interface FriendProfileDialogProps {
  friend: Friend | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FriendProfileDialog({ 
  friend, 
  open, 
  onOpenChange 
}: FriendProfileDialogProps) {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"schedule" | "achievements">("schedule");

  useEffect(() => {
    if (open && friend) {
      fetchFriendProfile(friend.id);
    }
  }, [open, friend]);

  const fetchFriendProfile = async (friendId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/friends/${friendId}/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      } else {
        console.error("Failed to fetch friend profile");
        setProfile({ shifts: [], achievements: [], totalShifts: 0, totalHours: 0 });
      }
    } catch (error) {
      console.error("Error fetching friend profile:", error);
      setProfile({ shifts: [], achievements: [], totalShifts: 0, totalHours: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setProfile(null);
    setActiveTab("schedule");
  };

  if (!friend) return null;

  const displayName = friend.name || 
    `${friend.firstName || ""} ${friend.lastName || ""}`.trim() || 
    friend.email;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={friend.profilePhotoUrl || undefined} 
                alt={displayName}
              />
              <AvatarFallback className="bg-blue-500 text-white">
                {(friend.firstName?.[0] || friend.name?.[0] || friend.email[0]).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <p className="text-sm text-gray-600">
                Friends since {new Date(friend.friendsSince).toLocaleDateString()}
              </p>
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-600">Loading profile...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Stats */}
            {profile && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{profile.totalShifts}</div>
                    <div className="text-sm text-gray-600">Total Shifts</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{profile.totalHours}h</div>
                    <div className="text-sm text-gray-600">Hours Volunteered</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={activeTab === "schedule" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("schedule")}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button
                variant={activeTab === "achievements" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("achievements")}
                className="flex-1"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </Button>
            </div>

            {/* Tab Content */}
            {activeTab === "schedule" && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Upcoming Shifts
                </h3>
                {profile?.shifts.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No upcoming shifts scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile?.shifts.map((shift) => (
                      <Card key={shift.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{shift.shiftType.name}</h4>
                              <p className="text-sm text-gray-600 mb-2">
                                {shift.shiftType.description}
                              </p>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {format(new Date(shift.start), "MMM d, h:mm a")} - 
                                  {format(new Date(shift.end), "h:mm a")}
                                </div>
                                {shift.location && (
                                  <div className="flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {shift.location}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant={shift.status === "CONFIRMED" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {shift.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "achievements" && (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center">
                  <Trophy className="h-4 w-4 mr-2" />
                  Achievements
                </h3>
                {profile?.achievements.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No achievements unlocked yet</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {profile?.achievements.map((userAchievement) => (
                      <Card key={userAchievement.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">{userAchievement.achievement.icon}</div>
                            <div className="flex-1">
                              <h4 className="font-medium">{userAchievement.achievement.name}</h4>
                              <p className="text-sm text-gray-600 mb-2">
                                {userAchievement.achievement.description}
                              </p>
                              <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-xs">
                                  {userAchievement.achievement.category}
                                </Badge>
                                <div className="text-xs text-gray-500">
                                  Unlocked {format(new Date(userAchievement.unlockedAt), "MMM d, yyyy")}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-yellow-600">
                              {userAchievement.achievement.points} pts
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}