"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-12">
      <PageHeader
        title={
          <>
            Kia ora — something went <em>wrong</em>
          </>
        }
        description="We've been notified and will look into it. You can try again, or head back to the dashboard."
        sparkle={false}
        align="center"
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
