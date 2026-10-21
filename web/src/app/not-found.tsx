import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/**
 * 404 for everything outside /admin (which has its own, inside the admin
 * chrome). Renders inside the root layout, so the site header and footer
 * stay available as ways back. Next adds the noindex robots tag itself.
 */
export default function NotFound() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center py-12"
      data-testid="not-found-page"
    >
      <p
        aria-hidden
        className="display select-none text-[7rem] leading-none tracking-tight text-forest-500/15 sm:text-[10rem] dark:text-cream-50/10"
      >
        404
      </p>
      <PageHeader
        title={
          <>
            Nothing on the <em>menu</em> here
          </>
        }
        description="This page has moved or never existed. Find a shift to sign up for, or head back to the start."
        sparkle={false}
        align="center"
        className="-mt-2 sm:-mt-4"
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/shifts">Browse shifts</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </div>
  );
}
