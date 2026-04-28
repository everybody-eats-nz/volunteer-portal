import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { MotionPageContainer } from "@/components/motion-page-container";
import { MotionCard } from "@/components/motion-card";
import { buildPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export const metadata = buildPageMetadata({
  title: "Active status extended",
  description: "Confirmation that your active volunteer status has been extended.",
  path: "/archive/extended",
  noIndex: true,
});

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function ArchiveExtendedPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const success = status === "success";

  return (
    <MotionPageContainer
      className="min-h-[80vh] flex items-center justify-center"
      testid="archive-extended-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center">
          <PageHeader
            title={
              success ? "You're still with us — ka pai!" : "Link no longer valid"
            }
            description={
              success
                ? "Thanks for staying on. Your volunteer account will remain active."
                : "This extension link has expired or already been used."
            }
            className="mb-6"
          />
        </div>

        <MotionCard testid="archive-extended-card">
          <CardContent className="p-8">
            <div
              className={`flex items-start gap-4 rounded-lg border p-4 ${
                success
                  ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-100"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
              }`}
              data-testid={success ? "extend-success" : "extend-invalid"}
            >
              {success ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="space-y-2 text-sm leading-relaxed">
                {success ? (
                  <>
                    <p className="font-medium">
                      Ngā mihi — we&apos;ve extended your active status.
                    </p>
                    <p>
                      You won&apos;t receive another inactivity reminder for a
                      while. Jump back in whenever you&apos;re ready.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      We couldn&apos;t verify this extension link.
                    </p>
                    <p>
                      It may have expired, already been used, or your account
                      has been archived. Sign in to reactivate your account or
                      contact us for a fresh link.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button asChild size="lg" data-testid="extended-browse-shifts">
                <Link href="/shifts">Browse shifts</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                data-testid="extended-go-home"
              >
                <Link href="/">Back to home</Link>
              </Button>
            </div>
          </CardContent>
        </MotionCard>
      </div>
    </MotionPageContainer>
  );
}
