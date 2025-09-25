import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Mail, Clock, Heart } from "lucide-react";
import { FriendRequest } from "@/lib/friends-data";
import { AcceptFriendRequestButton } from "./accept-friend-request-button";
import { DeclineFriendRequestButton } from "./decline-friend-request-button";
import { differenceInDays, format } from "date-fns";

interface FriendRequestsListProps {
  pendingRequests: FriendRequest[];
}

export function FriendRequestsList({ pendingRequests }: FriendRequestsListProps) {
  if (pendingRequests.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-12 text-center">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-10 w-10 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold mb-3 text-foreground">All caught up!</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
    );
  }

  return (
    <div className="space-y-6">
      {pendingRequests.map((request) => {
        const displayName = request.fromUser.name || 
          `${request.fromUser.firstName || ""} ${request.fromUser.lastName || ""}`.trim() || 
          request.fromUser.email;
        const daysAgo = differenceInDays(new Date(), new Date(request.createdAt));
        const isRecent = daysAgo <= 1;
        
        return (
          <Card key={request.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="relative">
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
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-background flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-foreground">
                        {displayName}
                      </h3>
                      {isRecent && (
                        <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      <span>
                        {daysAgo === 0 ? "Today" : 
                         daysAgo === 1 ? "Yesterday" : 
                         daysAgo <= 7 ? `${daysAgo} days ago` :
                         format(new Date(request.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    
                    {request.message && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg border-l-2 border-primary/30">
                        <div className="flex items-start gap-2">
                          <MessageCircle className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground italic">
                            &quot;{request.message}&quot;
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:ml-4">
                  <AcceptFriendRequestButton requestId={request.id} />
                  <DeclineFriendRequestButton requestId={request.id} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}