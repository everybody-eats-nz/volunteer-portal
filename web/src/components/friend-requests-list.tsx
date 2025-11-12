import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Clock, Heart } from "lucide-react";
import { FriendRequest } from "@/lib/friends-data";
import { AcceptFriendRequestButton } from "./accept-friend-request-button";
import { DeclineFriendRequestButton } from "./decline-friend-request-button";
import { differenceInDays, format } from "date-fns";
import { motion } from "motion/react";
import { staggerContainer } from "@/lib/motion";
import { MotionFriendRequest } from "./motion-friends";

interface FriendRequestsListProps {
  pendingRequests: FriendRequest[];
}

export function FriendRequestsList({ pendingRequests }: FriendRequestsListProps) {
  if (pendingRequests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <motion.div
              className="w-24 h-24 bg-blue-50 dark:bg-blue-950/20 rounded-full flex items-center justify-center mx-auto mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              >
                <Mail className="h-12 w-12 text-blue-500 dark:text-blue-400" />
              </motion.div>
            </motion.div>

            <h3 className="text-xl font-semibold mb-3 text-foreground">All caught up!</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              You don&apos;t have any pending friend requests right now. When someone sends you a request, it will appear here.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Badge variant="outline" className="text-sm">
                <Heart className="h-3 w-3 mr-1" />
                Build your network
              </Badge>
              <Badge variant="outline" className="text-sm">
                <MessageCircle className="h-3 w-3 mr-1" />
                Connect with volunteers
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {pendingRequests.map((request) => {
        const displayName = request.fromUser.name ||
          `${request.fromUser.firstName || ""} ${request.fromUser.lastName || ""}`.trim() ||
          request.fromUser.email;
        const daysAgo = differenceInDays(new Date(), new Date(request.createdAt));
        const isRecent = daysAgo <= 1;

        return (
          <MotionFriendRequest key={request.id} isNew={isRecent}>
            <Card className="group hover:shadow-lg hover:border-primary/30 transition-all duration-200 border-l-4 border-l-blue-500 dark:border-l-blue-400 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* User info section */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-14 w-14 ring-2 ring-blue-100 dark:ring-blue-900/50 group-hover:ring-blue-200 dark:group-hover:ring-blue-800/50 transition-all">
                        <AvatarImage
                          src={request.fromUser.profilePhotoUrl || undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950/50 dark:to-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-lg">
                          {(request.fromUser.firstName?.[0] ||
                            request.fromUser.name?.[0] ||
                            request.fromUser.email[0]).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isRecent && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-background flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                        >
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-semibold text-lg text-foreground">
                            {displayName}
                          </h3>
                          {isRecent && (
                            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 text-xs">
                              New Request
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>
                            {daysAgo === 0 ? "Sent today" :
                             daysAgo === 1 ? "Sent yesterday" :
                             daysAgo <= 7 ? `Sent ${daysAgo} days ago` :
                             `Sent ${format(new Date(request.createdAt), "MMM d, yyyy")}`}
                          </span>
                        </div>
                      </div>

                      {request.message && (
                        <div className="p-4 bg-muted/50 rounded-lg border-l-2 border-primary/30">
                          <div className="flex items-start gap-2">
                            <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground italic">
                              &quot;{request.message}&quot;
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 sm:ml-0 lg:ml-4">
                    <AcceptFriendRequestButton requestId={request.id} />
                    <DeclineFriendRequestButton requestId={request.id} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </MotionFriendRequest>
        );
      })}
    </motion.div>
  );
}