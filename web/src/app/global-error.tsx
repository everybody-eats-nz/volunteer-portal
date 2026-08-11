"use client";

import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { claimGlobalErrorAutoReload } from "@/lib/global-error-recovery";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    posthog.captureException(error, {
      digest: error.digest,
      scope: "global-error",
    });
  }, [error]);

  // A global error tears down the whole React root, so Next's `reset()` can only
  // re-render the same root in the same JS context — useless for crashes rooted
  // in module-level React state, which just throw again straight away and trap
  // the volunteer here. Reload the document instead; see
  // `@/lib/global-error-recovery` for why this is capped at once per session.
  useEffect(() => {
    if (
      claimGlobalErrorAutoReload(
        typeof window === "undefined" ? null : window.sessionStorage
      )
    ) {
      window.location.reload();
    }
  }, []);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Kia ora — we hit an unexpected error. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={() => {
              setReloading(true);
              window.location.reload();
            }}
            disabled={reloading}
            style={{
              display: "inline-block",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              background: "#111",
              color: "#fff",
              border: 0,
              cursor: reloading ? "default" : "pointer",
              opacity: reloading ? 0.6 : 1,
              font: "inherit",
            }}
          >
            {reloading ? "Reloading…" : "Reload page"}
          </button>
        </div>
      </body>
    </html>
  );
}
