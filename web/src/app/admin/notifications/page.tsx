import { Metadata } from "next";
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { NotificationsContent } from "./notifications-content";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { getActiveLocationNames } from "@/lib/locations";

export const metadata: Metadata = {
  title: "Shortage Alerts",
  description: "Send shift shortage notifications to volunteers",
};

export default async function NotificationsPage() {
  await connection();

  // Checked here as well as in the admin layout: a page renders independently
  // of its layout, so the layout's redirect does not protect this data.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin/notifications");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

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

  const locations = await getActiveLocationNames();

  return (
    <AdminPageWrapper
      title="Shift Shortage Notifications"
      description="Send shift shortage notifications to volunteers"
    >
      <div className="container mx-auto py-8 px-4">
        <NotificationsContent shiftTypes={shiftTypes} locations={locations} />
      </div>
    </AdminPageWrapper>
  );
}
