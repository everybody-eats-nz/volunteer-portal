import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AutoApprovalClient } from "./auto-approval-client";

export const metadata: Metadata = {
  title: "Auto-Approval | Admin Dashboard",
  description:
    "See who gets approved automatically, why, and who would be next.",
};

export default async function AutoApprovalPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login?callbackUrl=/admin/auto-approval");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminPageWrapper
      title="Auto-Approval"
      description="Which signups confirm themselves, which wait for a person, and the reasoning behind every call."
    >
      <AutoApprovalClient />
    </AdminPageWrapper>
  );
}
