import { Metadata } from "next";
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { MessagingHoursEditor } from "@/components/admin/messages/messaging-hours-editor";
import { getAllLocationHours } from "@/lib/services/messaging-hours";

export const metadata: Metadata = {
  title: "Messaging Hours | Admin",
  description: "Set per-day messaging hours per location",
};

export default async function MessagingHoursPage() {
  await connection();
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const locations = await getAllLocationHours();

  return (
    <AdminPageWrapper
      title="Messaging Hours"
      description="Configure when the team typically replies to volunteer messages — shown in the mobile app as a soft expectation-setter"
    >
      <PageContainer>
        <MessagingHoursEditor initialLocations={locations} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
