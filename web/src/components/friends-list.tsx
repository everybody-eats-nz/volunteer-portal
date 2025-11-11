import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Heart, Clock } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import { RemoveFriendButton } from "./remove-friend-button";
import { ViewFriendProfileButton } from "./view-friend-profile-button";
import { differenceInDays, format } from "date-fns";
import { motion } from "motion/react";
import { staggerContainer } from "@/lib/motion";
import { MotionFriendCard } from "./motion-friends";

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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="py-16 text-center">
            <motion.div
              className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Users className="h-12 w-12 text-primary" />
              </motion.div>
            </motion.div>

            <h3 className="text-xl font-semibold mb-3 text-foreground">
              {searchTerm ? "No matches found" : "No friends yet"}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
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
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search results indicator */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredFriends.length}{" "}
          {filteredFriends.length === 1 ? "friend" : "friends"}
          {searchTerm && " found"}
        </p>
        {searchTerm && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Badge variant="secondary">Searching for "{searchTerm}"</Badge>
          </motion.div>
        )}
      </div>

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
            <MotionFriendCard key={friend.friendshipId}>
              <Card className="py-2 group hover:border-primary/50 transition-all shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm">
                            <AvatarImage
                              src={friend.profilePhotoUrl || undefined}
                              alt={displayName}
                            />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                              {(
                                friend.firstName?.[0] ||
                                friend.name?.[0] ||
                                friend.email[0]
                              ).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isRecentFriend && (
                            <motion.div
                              className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background shadow-sm"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", delay: 0.2 }}
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate mb-0.5">
                            {displayName}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            Friends for{" "}
                            {daysSinceFriendship === 0
                              ? "today"
                              : daysSinceFriendship === 1
                              ? "1 day"
                              : `${daysSinceFriendship} days`}
                          </p>
                          {isRecentFriend && (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50 text-xs mt-1"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              New
                            </Badge>
                          )}
                        </div>
                      </div>
                      <RemoveFriendButton friendId={friend.id} />
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="px-3 py-2">
                    <ViewFriendProfileButton friend={friend} />
                  </div>
                </CardContent>
              </Card>
            </MotionFriendCard>
          );
        })}
      </motion.div>
    </div>
  );
}
