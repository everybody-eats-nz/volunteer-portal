"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

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
    <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="font-fraunces text-4xl font-bold tracking-tight">
        Kia ora — something went wrong
      </h1>
      <p className="mt-4 max-w-prose text-muted-foreground">
        We&apos;ve been notified and will look into it. You can try again, or
        head back to the dashboard.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
