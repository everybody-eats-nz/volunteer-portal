import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { ArchivingTabs } from "./archiving-tabs";

export const metadata: Metadata = {
  title: "Volunteer Archiving | Admin Dashboard",
  description:
    "Monitor inactivity rules and manually trigger archive passes or per-user actions.",
};

export default async function ArchivingPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) redirect("/login?callbackUrl=/admin/archiving");
  if (role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminPageWrapper
      title="Volunteer Archiving"
      description="Soft-archive inactive volunteers based on Nic's rules. Run passes manually while the cron is being set up — per-rule actions and a full activity log are available below."
    >
      <div className="space-y-6">
        <ArchivingTabs />
      </div>
    </AdminPageWrapper>
  );
}
