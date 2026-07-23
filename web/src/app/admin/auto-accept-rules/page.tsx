import { getActiveLocationNames } from "@/lib/locations";
import AutoAcceptRulesClient from "./auto-accept-rules-client";

export default async function NotificationsPage() {
  const locations = await getActiveLocationNames();
  return <AutoAcceptRulesClient locations={locations} />;
}
