import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Heart, Clock } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import { RemoveFriendButton } from "./remove-friend-button";
import { ViewFriendProfileButton } from "./view-friend-profile-button";
import { differenceInDays, format } from "date-fns";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface FriendsListProps {
  friends: Friend[];
  searchTerm: string;
}

export function FriendsList({ friends, searchTerm }: FriendsListProps) {
  const filteredFriends = friends.filter(
    (friend) =>
      friend.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredFriends.length === 0) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors py-2">
        <CardContent className="py-12 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-foreground">
            {searchTerm ? "No matches found" : "No friends yet"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {searchTerm
              ? "Try adjusting your search terms to find the friends you're looking for."
              : "Start building your volunteer network by connecting with other volunteers!"}
          </p>
          {!searchTerm && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Badge variant="outline" className="text-sm">
                <Heart className="h-3 w-3 mr-1" />
                Connect with volunteers
              </Badge>
              <Badge variant="outline" className="text-sm">
                <Calendar className="h-3 w-3 mr-1" />
                Share volunteering experiences
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {filteredFriends.map((friend) => {
        const displayName =
          friend.name ||
          `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
          friend.email;
        const friendsSinceDate = new Date(friend.friendsSince);
        const daysSinceFriendship = differenceInDays(
          new Date(),
          friendsSinceDate
        );
        const isRecentFriend = daysSinceFriendship <= 30;

        return (
          <motion.div key={friend.friendshipId} variants={staggerItem}>
            <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/40 shadow-sm">
              <CardContent className="relative overflow-hidden flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-border group-hover:border-primary/40 transition-colors">
                        <AvatarImage
                          src={friend.profilePhotoUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {(
                            friend.firstName?.[0] ||
                            friend.name?.[0] ||
                            friend.email[0]
                          ).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isRecentFriend && (
                        <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-foreground truncate">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Heart className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {daysSinceFriendship === 0
                            ? "Today"
                            : daysSinceFriendship === 1
                            ? "1 day ago"
                            : daysSinceFriendship <= 7
                            ? `${daysSinceFriendship} days ago`
                            : format(friendsSinceDate, "MMM d, yyyy")}
                        </p>
                        {isRecentFriend && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50 text-xs h-fit"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <RemoveFriendButton friendId={friend.id} />
                </div>

                <div className="flex-1"></div>

                <div className="mt-auto space-y-3">
                  <ViewFriendProfileButton friend={friend} />

                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground text-center">
                      Connected for {daysSinceFriendship} day
                      {daysSinceFriendship !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
