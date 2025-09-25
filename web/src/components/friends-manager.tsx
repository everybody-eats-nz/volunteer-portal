"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SendFriendRequestDialog } from "@/components/send-friend-request-dialog";
import { FriendPrivacySettings } from "@/components/friend-privacy-settings";
import { FriendProfileDialog } from "@/components/friend-profile-dialog";
import { 
  Users, 
  UserPlus, 
  Settings, 
  Calendar,
  Search,
  MessageCircle,
  Check,
  X
} from "lucide-react";

interface Friend {
  friendshipId: string;
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  friendsSince: string;
}

interface FriendRequest {
  id: string;
  message: string | null;
  fromUser: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
  };
  createdAt: string;
}

interface FriendsData {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
}

export function FriendsManager() {
  const [friendsData, setFriendsData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showFriendProfile, setShowFriendProfile] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await fetch("/api/friends");
      if (response.ok) {
        const data = await response.json();
        setFriendsData(data);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/accept`, {
        method: "POST",
      });
      if (response.ok) {
        fetchFriends(); // Refresh the list
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/friends/requests/${requestId}/decline`, {
        method: "POST",
      });
      if (response.ok) {
        fetchFriends(); // Refresh the list
      }
    } catch (error) {
      console.error("Error declining friend request:", error);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm("Are you sure you want to remove this friend?")) {
      return;
    }

    try {
      const response = await fetch(`/api/friends/${friendId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchFriends(); // Refresh the list
      }
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };

  const handleViewProfile = (friend: Friend) => {
    setSelectedFriend(friend);
    setShowFriendProfile(true);
  };

  const filteredFriends = friendsData?.friends.filter(friend =>
    friend.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (loading) {
    return <div className="flex justify-center py-8">Loading friends...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search friends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowPrivacySettings(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Privacy Settings
          </Button>
          <Button onClick={() => setShowSendRequest(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Friend
          </Button>
        </div>
      </div>

      <Tabs defaultValue="friends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="friends">
            <Users className="h-4 w-4 mr-2" />
            Friends ({friendsData?.friends.length || 0})
          </TabsTrigger>
          <TabsTrigger value="requests">
            <MessageCircle className="h-4 w-4 mr-2" />
            Requests ({friendsData?.pendingRequests.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {filteredFriends.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No friends yet</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm
                    ? "No friends match your search."
                    : "Start building your volunteer network by adding friends!"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowSendRequest(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Your First Friend
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFriends.map((friend) => (
                <Card key={friend.friendshipId}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={friend.profilePhotoUrl || undefined} 
                            alt={friend.name || "Friend"}
                          />
                          <AvatarFallback className="bg-blue-500 text-white">
                            {(friend.firstName?.[0] || friend.name?.[0] || friend.email[0]).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">
                            {friend.name || `${friend.firstName || ""} ${friend.lastName || ""}`.trim() || friend.email}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Friends since {new Date(friend.friendsSince).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                    
                    <div className="mt-4 flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleViewProfile(friend)}
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          {(friendsData?.pendingRequests.length || 0) === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No pending requests</h3>
                <p className="text-gray-600">
                  You don&apos;t have any pending friend requests.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {friendsData?.pendingRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={request.fromUser.profilePhotoUrl || undefined} 
                            alt={request.fromUser.name || "User"}
                          />
                          <AvatarFallback className="bg-blue-500 text-white">
                            {(request.fromUser.firstName?.[0] || 
                              request.fromUser.name?.[0] || 
                              request.fromUser.email[0]).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">
                            {request.fromUser.name || 
                             `${request.fromUser.firstName || ""} ${request.fromUser.lastName || ""}`.trim() || 
                             request.fromUser.email}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Sent {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                          {request.message && (
                            <p className="text-sm mt-1 italic">
                              &quot;{request.message}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeclineRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SendFriendRequestDialog
        open={showSendRequest}
        onOpenChange={setShowSendRequest}
        onSuccess={fetchFriends}
      />

      <FriendPrivacySettings
        open={showPrivacySettings}
        onOpenChange={setShowPrivacySettings}
      />

      <FriendProfileDialog
        friend={selectedFriend}
        open={showFriendProfile}
        onOpenChange={setShowFriendProfile}
      />
    </div>
  );
}