import { LOCATIONS } from "@/lib/locations";
import AutoAcceptRulesClient from "./auto-accept-rules-client";

export default async function NotificationsPage() {
  return <AutoAcceptRulesClient locations={LOCATIONS} />;
}
