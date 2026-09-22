"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Clock, MapPin, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface WaitlistOffer {
  shiftId: string;
  shiftName: string;
  /** Pre-formatted in NZ time by the server - no device-local date maths. */
  shiftWhen: string;
  location: string | null;
  /** Pre-formatted deadline, e.g. "7:30pm Thursday". */
  expiresLabel: string;
}

/**
 * "A spot just opened up."
 *
 * The one thing on this page a volunteer has to act on, and it has a deadline,
 * so it sits above everything else rather than inside a row they'd have to go
 * looking for. The push notification that created the offer deep-links here.
 *
 * Deliberately not a dialog: an offer that interrupts you the moment you open
 * the app is an offer you dismiss by reflex.
 */
export function WaitlistOfferBanner({ offers }: { offers: WaitlistOffer[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Offers answered in this render pass, so the card disappears immediately
  // rather than waiting on the refresh.
  const [answered, setAnswered] = useState<Set<string>>(new Set());

  const visible = offers.filter((o) => !answered.has(o.shiftId));
  if (visible.length === 0) return null;

  async function respond(shiftId: string, action: "accept" | "decline") {
    setPending(`${shiftId}:${action}`);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/waitlist-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error ?? "Something went wrong. Please try again."
        );
        return;
      }
      setAnswered((prev) => new Set(prev).add(shiftId));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Please check your connection.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mb-8 space-y-3" data-testid="waitlist-offers">
      {visible.map((offer) => (
        <div
          key={offer.shiftId}
          data-testid={`waitlist-offer-${offer.shiftId}`}
          className="grain relative overflow-hidden rounded-[2rem] border border-sun-300/70 bg-sun-100 p-5 sm:p-6 dark:border-sun-200/30 dark:bg-sun-200/10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow mb-2 flex items-center gap-2 text-forest-700/80 dark:text-sun-100">
                <Sparkles className="h-4 w-4" aria-hidden />
                A spot just opened up
              </p>
              <h3 className="display text-xl tracking-tight text-forest-700 sm:text-2xl dark:text-cream-50">
                {offer.shiftName}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-forest-700/75 dark:text-cream-50/75">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {offer.shiftWhen}
                </span>
                {offer.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {offer.location}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-forest-700/70 dark:text-cream-50/65">
                It&apos;s yours if you want it - let us know by{" "}
                <strong className="font-semibold text-forest-700 dark:text-cream-50">
                  {offer.expiresLabel}
                </strong>{" "}
                and it&apos;s confirmed. After that it goes to the next person
                on the waitlist.
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={() => respond(offer.shiftId, "decline")}
                disabled={pending !== null}
                data-testid={`waitlist-offer-decline-${offer.shiftId}`}
              >
                {pending === `${offer.shiftId}:decline`
                  ? "Passing…"
                  : "No thanks"}
              </Button>
              <Button
                onClick={() => respond(offer.shiftId, "accept")}
                disabled={pending !== null}
                data-testid={`waitlist-offer-accept-${offer.shiftId}`}
                className="bg-forest-500 text-cream-50 hover:bg-forest-600"
              >
                {pending === `${offer.shiftId}:accept`
                  ? "Confirming…"
                  : "Yes, I'll take it"}
              </Button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              data-testid="waitlist-offer-error"
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
