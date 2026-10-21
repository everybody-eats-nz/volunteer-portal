import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { MyShiftsContent } from "./my-shifts-content";
import { MyShiftsContentSkeleton } from "./my-shifts-skeleton";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

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
      <PageHeader
        title={
          <>
            My <em>Shifts</em>
          </>
        }
        description="Your volunteer schedule and shift history."
        className="pb-4"
      />

      <Suspense fallback={<MyShiftsContentSkeleton />}>
        <MyShiftsContent userId={userId} monthParam={monthParam} />
      </Suspense>
    </PageContainer>
  );
}
