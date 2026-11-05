"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Clock, Hourglass, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CancelSignupButton } from "./cancel-signup-button";
import { WAITLIST_CONFIRM_BODY, WAITLIST_CONFIRM_TITLE } from "@/lib/waitlist";

export interface WaitlistConfirmRequest {
  shiftId: string;
  shiftName: string;
  /** Pre-formatted in NZ time by the server. */
  shiftWhen: string;
  location: string | null;
}

/**
 * "Keep your waitlist place?"
 *
 * The team put this volunteer on a waitlist they never asked to join, so
 * nothing is offered to them until they say they want to wait. Sits under the
 * offers banner: it needs an answer, but carries no deadline.
 */
export function WaitlistConfirmBanner({
  requests,
}: {
  requests: WaitlistConfirmRequest[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());

  const visible = requests.filter((r) => !kept.has(r.shiftId));
  if (visible.length === 0) return null;

  async function keep(shiftId: string) {
    setPending(shiftId);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/waitlist-confirm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't keep your place. Please try again.");
        return;
      }
      setKept((prev) => new Set(prev).add(shiftId));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please check your connection.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mb-8 space-y-3" data-testid="waitlist-confirm-requests">
      {visible.map((request) => (
        <div
          key={request.shiftId}
          data-testid={`waitlist-confirm-${request.shiftId}`}
          className="rounded-[2rem] border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Hourglass className="h-4 w-4" aria-hidden />
                {WAITLIST_CONFIRM_TITLE}
              </p>
              <h3 className="display text-xl tracking-tight text-foreground sm:text-2xl">
                {request.shiftName}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {request.shiftWhen}
                </span>
                {request.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {request.location}
                  </span>
                )}
              </div>
              <p className="mt-3 max-w-prose text-sm text-muted-foreground">
                {WAITLIST_CONFIRM_BODY}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <CancelSignupButton
                shiftId={request.shiftId}
                shiftName={request.shiftName}
                isWaitlisted
              />
              <Button
                onClick={() => keep(request.shiftId)}
                disabled={pending !== null}
                data-testid={`waitlist-confirm-keep-${request.shiftId}`}
                className="bg-forest-500 text-cream-50 hover:bg-forest-600"
              >
                {pending === request.shiftId ? "Keeping…" : "Keep my place"}
              </Button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              data-testid="waitlist-confirm-error"
              className="mt-4 flex items-start gap-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
