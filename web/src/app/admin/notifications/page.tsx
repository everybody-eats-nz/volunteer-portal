import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NotificationsContent } from "./notifications-content";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { LOCATIONS } from "@/lib/locations";

export const metadata: Metadata = {
  title: "Shift Shortage Notifications | Admin",
  description: "Send shift shortage notifications to volunteers",
};

export default async function NotificationsPage() {
  // Fetch shift types on the server
  const shiftTypes = await prisma.shiftType.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <AdminPageWrapper
      title="Shift Shortage Notifications"
      description="Send shift shortage notifications to volunteers"
    >
      <div className="container mx-auto py-8 px-4">
        <NotificationsContent shiftTypes={shiftTypes} locations={LOCATIONS} />
      </div>
    </AdminPageWrapper>
  );
}
