import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { MigrationTabs } from "./migration-tabs";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";

export const metadata: Metadata = {
  title: "User Migration | Admin Dashboard",
  description: "Migrate users from legacy volunteer portal",
};

export default async function MigrationPage() {
  // Check authentication and admin role
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/migration");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <AdminPageWrapper 
      title="User Migration" 
      description="Import users from the legacy volunteer portal and send invitations to join the new system."
    >
      <div className="space-y-6">
        <MigrationTabs />
      </div>
    </AdminPageWrapper>
  );
}
