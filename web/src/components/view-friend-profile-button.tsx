import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { Friend } from "@/lib/friends-data";
import Link from "next/link";

interface ViewFriendProfileButtonProps {
  friend: Friend;
}

export function ViewFriendProfileButton({ friend }: ViewFriendProfileButtonProps) {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex-1"
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