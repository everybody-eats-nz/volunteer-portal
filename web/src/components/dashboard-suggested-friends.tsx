import { getRecommendedFriends } from "@/lib/friends-data";
import { DashboardSuggestedFriendsList } from "@/components/dashboard-suggested-friends-list";

export async function DashboardSuggestedFriends() {
  const recommendedFriends = await getRecommendedFriends();

  if (recommendedFriends.length === 0) {
    return null;
  }

  return <DashboardSuggestedFriendsList friends={recommendedFriends} />;
}
