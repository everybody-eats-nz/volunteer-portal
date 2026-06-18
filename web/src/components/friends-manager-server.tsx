"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, UserPlus } from "lucide-react";
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

/* Pill tab triggers — the marketing site's chip system rather than the
   default shadcn segmented control. Active = filled forest pill. */
const pillTab =
  "h-11 flex-none rounded-full border border-forest-500/20 bg-transparent px-5 text-sm font-medium text-forest-700/80 shadow-none transition-all duration-200 hover:border-forest-500/40 hover:text-forest-700 data-[state=active]:border-forest-500 data-[state=active]:bg-forest-500 data-[state=active]:text-cream-50 data-[state=active]:shadow-sm dark:border-cream-50/20 dark:text-cream-50/75 dark:hover:border-cream-50/40 dark:hover:text-cream-50 dark:data-[state=active]:border-forest-500 dark:data-[state=active]:bg-forest-500 dark:data-[state=active]:text-cream-50";

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
    <div className="space-y-10">
      {/* Toolbar — search the roster, grow the whānau */}
      <section className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-5 sm:p-6 dark:border-cream-50/10">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <FriendsSearch onSearchChange={setSearchTerm} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setShowPrivacySettings(true)}
              data-testid="privacy-settings-button"
              aria-label="Open privacy settings"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-forest-500/30 px-6 py-3 text-sm font-medium text-forest-700 transition-all duration-200 hover:border-forest-700 hover:bg-forest-700 hover:text-cream-50 dark:border-cream-50/30 dark:text-cream-50 dark:hover:border-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Privacy Settings
            </button>
            <button
              type="button"
              onClick={() => setShowSendRequest(true)}
              data-testid="add-friend-button"
              aria-label="Send a friend request"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-forest-500 px-6 py-3 text-sm font-medium text-cream-50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lg active:translate-y-0"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Add Friend
            </button>
          </div>
        </div>
      </section>

      <Tabs defaultValue={initialTab} className="gap-8">
        <TabsList
          data-testid="friends-tabs"
          aria-label="Friends and requests navigation"
          className="h-auto w-full justify-start gap-2 rounded-none border-0 bg-transparent p-0 dark:border-0 dark:bg-transparent"
        >
          <TabsTrigger value="friends" data-testid="friends-tab" className={pillTab}>
            Friends
            {friends.length > 0 && (
              <span
                aria-label={`${friends.length} friends`}
                className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-forest-500/10 px-1.5 text-xs font-semibold tabular-nums in-data-[state=active]:bg-cream-50/20 in-data-[state=active]:text-cream-50 dark:bg-cream-50/15"
              >
                {friends.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="requests-tab" className={pillTab}>
            Requests
            {hasNewRequests && (
              <motion.span
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                aria-label={`${pendingRequests.length} pending requests`}
                className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sun-200 px-1.5 text-xs font-semibold text-forest-700 tabular-nums"
              >
                {pendingRequests.length}
              </motion.span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="friends"
          className="space-y-6"
          data-testid="friends-tab-content"
        >
          <FriendsList
            friends={friends}
            searchTerm={searchTerm}
            onAddFriend={() => setShowSendRequest(true)}
          />
        </TabsContent>

        <TabsContent
          value="requests"
          className="space-y-6"
          data-testid="requests-tab-content"
        >
          <FriendRequestsList pendingRequests={pendingRequests} />
        </TabsContent>
      </Tabs>

      {/* People you may know — shared-shift suggestions */}
      <RecommendedFriends />

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
