import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { getEmailTemplateStatuses } from "@/lib/email-catalog.server";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { EmailCatalogList } from "./email-catalog-list";

export const metadata: Metadata = {
  title: "Automated Emails",
  description:
    "Every email the portal sends by itself, and the Campaign Monitor template behind each one.",
};

export default async function AutomatedEmailsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login?callbackUrl=/admin/emails");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const statuses = await getEmailTemplateStatuses();

  return (
    <AdminPageWrapper
      title="Automated Emails"
      description="Every email the portal sends by itself, and the Campaign Monitor template behind each one."
    >
      <PageContainer testid="admin-emails-page">
        <EmailCatalogList statuses={statuses} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
