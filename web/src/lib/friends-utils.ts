export interface RecommendedFriend {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  sharedShiftsCount: number;
  recentSharedShifts: Array<{
    id: string;
    start: string;
    shiftTypeName: string;
    location: string | null;
  }>;
}

export function getRecommendedFriendDisplayName(
  friend: Pick<RecommendedFriend, "firstName" | "lastName" | "name">
) {
  if (friend.firstName && friend.lastName) {
    return `${friend.firstName} ${friend.lastName[0]}.`;
  }
  if (friend.firstName) {
    return friend.firstName;
  }
  if (friend.name) {
    const parts = friend.name.split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return friend.name;
  }
  return "Volunteer";
}

export function getRecommendedFriendInitials(
  friend: Pick<RecommendedFriend, "firstName" | "name">
) {
  return (friend.firstName?.[0] || friend.name?.[0] || "V").toUpperCase();
}
