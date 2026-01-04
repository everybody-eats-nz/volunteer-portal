import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import NewsletterListsClient from "./newsletter-lists-client";

export default async function NewsletterListsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <AdminPageWrapper
      title="Newsletter Lists"
      description="Manage Campaign Monitor newsletter lists for volunteer subscriptions"
    >
      <PageContainer>
        <NewsletterListsClient />
      </PageContainer>
    </AdminPageWrapper>
  );
}
