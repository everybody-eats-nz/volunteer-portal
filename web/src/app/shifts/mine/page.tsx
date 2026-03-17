import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { MyShiftsContent } from "./my-shifts-content";
import { MyShiftsContentSkeleton } from "./my-shifts-skeleton";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Shifts",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/shifts/mine");
  }

  const params = await searchParams;
  const monthParam = params.month as string | undefined;

  return (
    <PageContainer testid="my-shifts-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="My Shifts"
          description="Your volunteer schedule and shift history."
          className="flex-1"
        />
      </div>

      <Suspense fallback={<MyShiftsContentSkeleton />}>
        <MyShiftsContent userId={userId} monthParam={monthParam} />
      </Suspense>
    </PageContainer>
  );
}
