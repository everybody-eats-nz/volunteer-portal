"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Settings, MessageCircle } from "lucide-react";
import { FriendsData } from "@/lib/friends-data";
import { FriendsList } from "./friends-list";
import { FriendRequestsList } from "./friend-requests-list";
import { FriendsSearch } from "./friends-search";
import { SendFriendRequestForm } from "./send-friend-request-form";
import { FriendPrivacySettings } from "./friend-privacy-settings";
import { RecommendedFriends } from "./recommended-friends";
import { motion } from "motion/react";

interface FriendsManagerServerProps {
  initialData: FriendsData;
  initialTab?: "friends" | "requests";
}

export function FriendsManagerServer({
  initialData,
  initialTab = "friends",
}: FriendsManagerServerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSendRequest, setShowSendRequest] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);

  const { friends, pendingRequests } = initialData;

  const hasNewRequests = pendingRequests.length > 0;

  return (
    <div className="space-y-8">
      {/* Enhanced Header Section */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-purple-500/5 dark:from-primary/10 dark:via-primary/8 dark:to-purple-500/10 rounded-xl p-8 lg:p-10 border border-primary/10 dark:border-primary/20 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 lg:gap-12">
          <div className="flex-1 max-w-xl space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                Connect & Discover
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Search for friends and manage your volunteer network
              </p>
            </div>
            <FriendsSearch onSearchChange={setSearchTerm} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
            <Button
              variant="outline"
              onClick={() => setShowPrivacySettings(true)}
              data-testid="privacy-settings-button"
              aria-label="Open privacy settings"
              className="hover:bg-muted/50 hover:border-primary/30 transition-all duration-200 shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Settings className="h-4 w-4 mr-2" />
              Privacy Settings
            </Button>
            <Button
              variant="default"
              onClick={() => setShowSendRequest(true)}
              data-testid="add-friend-button"
              aria-label="Send a friend request"
              className="shadow-sm hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Friend
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <Tabs defaultValue={initialTab} className="space-y-8">
          <TabsList
            data-testid="friends-tabs"
            aria-label="Friends and requests navigation"
            className="h-10 grid w-full sm:w-[400px] grid-cols-2 bg-muted/50 dark:bg-muted/30 p-1 rounded-lg shadow-sm"
          >
            <TabsTrigger
              value="friends"
              data-testid="friends-tab"
              className="relative transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center justify-center"
            >
              <Users className="h-4 w-4 mr-2" />
              Friends
              {friends.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 text-xs"
                  aria-label={`${friends.length} friends`}
                >
                  {friends.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="requests"
              data-testid="requests-tab"
              className="relative transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center justify-center"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Requests
              {hasNewRequests && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                >
                  <Badge
                    variant="destructive"
                    className="ml-2 text-xs"
                    aria-label={`${pendingRequests.length} pending requests`}
                  >
                    {pendingRequests.length}
                  </Badge>
                </motion.div>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="friends"
            className="space-y-6"
            data-testid="friends-tab-content"
          >
            <FriendsList friends={friends} searchTerm={searchTerm} />
          </TabsContent>

          <TabsContent
            value="requests"
            className="space-y-6"
            data-testid="requests-tab-content"
          >
            <FriendRequestsList pendingRequests={pendingRequests} />
          </TabsContent>
        </Tabs>

        {/* Recommended Friends Section - Show after tabs */}
        <RecommendedFriends />
      </div>

      <SendFriendRequestForm
        open={showSendRequest}
        onOpenChange={setShowSendRequest}
      />

      <FriendPrivacySettings
        open={showPrivacySettings}
        onOpenChange={setShowPrivacySettings}
      />
    </div>
  );
}
