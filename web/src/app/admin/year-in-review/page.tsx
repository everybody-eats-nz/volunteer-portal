import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { YearInReviewAdmin } from "@/components/admin/year-in-review/year-in-review-admin";
import {
  canManageYearInReview,
  getYearInReviewSettings,
  selectableYears,
} from "@/lib/year-in-review-settings";
import { countYearInReviewPeople } from "@/lib/year-in-review.server";

export const metadata: Metadata = {
  title: "Year in mahi",
};

export default async function YearInReviewAdminPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  if (!canManageYearInReview(session.user)) {
    redirect("/admin");
  }

  const settings = await getYearInReviewSettings();
  const people = await countYearInReviewPeople(settings.year);

  return (
    <AdminPageWrapper
      title="Year in mahi"
      description="A video of each person's year at Everybody Eats, made to share on Instagram"
    >
      <PageContainer>
        <YearInReviewAdmin
          initialSettings={settings}
          initialPeople={people}
          years={selectableYears()}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
