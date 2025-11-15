import { Button } from "@/components/ui/button";
import { Calendar, Lock } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import Link from "next/link";

interface ViewFriendProfileButtonProps {
  friend: Friend;
}

export function ViewFriendProfileButton({
  friend,
}: ViewFriendProfileButtonProps) {
  // If friend has private visibility, show disabled button
  if (friend.friendVisibility === "PRIVATE") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="flex-1 w-full"
        disabled
        data-testid="view-friend-profile-button"
      >
        <Lock className="h-3 w-3 mr-1" />
        Profile Private
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="flex-1 w-full"
      asChild
      data-testid="view-friend-profile-button"
    >
      <Link href={`/friends/${friend.id}`}>
        <Calendar className="h-3 w-3 mr-1" />
        View Profile
      </Link>
    </Button>
  );
}
