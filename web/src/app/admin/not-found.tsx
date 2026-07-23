"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Compass, LayoutDashboard } from "lucide-react";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { MotionPageContainer } from "@/components/motion-page-container";
import { Button } from "@/components/ui/button";

/**
 * 404 boundary for the admin area. Because it lives under `admin/layout.tsx`,
 * it renders inside the full admin chrome (sidebar + header), so admins always
 * have a way back to a working page. Triggered both by explicit `notFound()`
 * calls in admin routes and by unmatched `/admin/*` URLs via the sibling
 * `[...not-found]` catch-all route.
 */
export default function AdminNotFound() {
  const router = useRouter();

  // `router.back()` is a no-op when the admin landed here with no in-app
  // history (direct hit, external link, fresh tab), so fall back to the
  // dashboard to guarantee an escape route.
  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/admin");
    }
  };

  return (
    <AdminPageWrapper
      title="Page not found"
      description="We couldn't find the admin page you were looking for."
    >
      <MotionPageContainer>
        <div
          data-testid="admin-not-found"
          className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Compass className="h-8 w-8" aria-hidden="true" />
          </div>

          <p className="mt-6 text-sm font-medium text-muted-foreground">
            Error 404
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            This page took a wrong turn
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            The link may be broken, or the page may have been moved or removed.
            Kia ora - let&apos;s get you back to something useful.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild data-testid="admin-not-found-dashboard-link">
              <Link href="/admin">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleGoBack}
              data-testid="admin-not-found-back-button"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </Button>
          </div>
        </div>
      </MotionPageContainer>
    </AdminPageWrapper>
  );
}
