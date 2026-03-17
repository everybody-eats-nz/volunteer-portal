import { redirect } from "next/navigation";
import { getFriendsData } from "@/lib/friends-data";
import { FriendsManagerServer } from "@/components/friends-manager-server";

interface FriendsContentProps {
  initialTab: "friends" | "requests";
}

export async function FriendsContent({ initialTab }: FriendsContentProps) {
  const friendsData = await getFriendsData();

  if (!friendsData) {
    redirect("/login");
  }

  return (
    <FriendsManagerServer
      initialData={friendsData}
      initialTab={initialTab}
    />
  );
}
