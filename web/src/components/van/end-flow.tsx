"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DriverScreen, FlowHeader } from "@/components/van/van-chrome";
import { OdometerCapture } from "@/components/van/odometer-capture";
import {
  explainImplausible,
  hoursBetween,
  isImplausible,
} from "@/lib/van/plausibility";
import { formatDuration, formatKm, formatOdo } from "@/lib/van/format";

/**
 * Ending a trip. Warn, never block.
 *
 * The plausibility check here is the *same function* the office's exception
 * list runs, so a trip can never warn the driver and then look clean to the
 * office, or the reverse. Confirming past the warning records the trip and
 * flags it; it never stops the driver. The single hard stop — a reading at or
 * below the one the trip started at — is enforced in the capture field and
 * again on the server.
 */

export function EndFlow({
  trip,
}: {
  trip: {
    id: string;
    vehicleName: string;
    vehicleRego: string;
    startOdo: number;
    startedAt: string;
    purposeLabel: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{
    odo: number;
    photoUrl: string | null;
    /** Frozen at submit time so the wording does not drift while on screen. */
    at: Date;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    distance: number;
    duration: string;
  } | null>(null);

  const startedAt = new Date(trip.startedAt);

  async function close(
    odo: number,
    photoUrl: string | null,
    acknowledgedWarning: boolean
  ) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/van/trips/${trip.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endOdo: odo,
          endOdoPhotoUrl: photoUrl,
          acknowledgedWarning,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not end the trip.");
        setPending(null);
        setSubmitting(false);
        return;
      }
      setPending(null);
      setDone({
        distance: body.distanceKm ?? odo - trip.startOdo,
        duration: formatDuration(startedAt, new Date()),
      });
      // Deliberately no router.refresh() here. This screen's own server
      // component renders "this trip is already closed" once the trip is no
      // longer open, so refreshing would replace the confirmation the driver
      // just earned with an error-shaped page. Both links out of here are
      // ordinary navigations, which fetch fresh data anyway.
    } catch {
      setError("No connection. Try again in a moment.");
      setPending(null);
      setSubmitting(false);
    }
  }

  function submit(odo: number, photoUrl: string | null) {
    const at = new Date();
    if (isImplausible(odo - trip.startOdo, hoursBetween(startedAt, at))) {
      setPending({ odo, photoUrl, at });
      return;
    }
    void close(odo, photoUrl, false);
  }

  if (done) {
    return (
      <DriverScreen testid="van-trip-logged">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-8" aria-hidden />
          </span>
          <p className="mt-6 text-[15px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Trip logged
          </p>
          <p className="mt-2 text-[64px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            {formatKm(done.distance)}
          </p>
          <p className="mt-3 text-[15px] text-muted-foreground">
            {trip.vehicleName} · {done.duration} · {trip.purposeLabel}
          </p>
        </div>
        <div className="space-y-2.5 pb-4">
          <Button asChild size="xl" className="w-full">
            <Link href="/drive">Done</Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="w-full">
            <Link href={`/drive/trip/${trip.id}`}>See the trip</Link>
          </Button>
        </div>
      </DriverScreen>
    );
  }

  const warning = pending
    ? {
        distance: pending.odo - trip.startOdo,
        explanation: explainImplausible(
          pending.odo - trip.startOdo,
          hoursBetween(startedAt, pending.at)
        ),
        duration: formatDuration(startedAt, pending.at),
      }
    : null;

  return (
    <DriverScreen testid="van-end-flow">
      <FlowHeader
        onBack={() => router.push(`/drive/trip/${trip.id}`)}
        title={trip.vehicleName}
        sub={`${trip.vehicleRego} · started at ${formatOdo(trip.startOdo)} km`}
      />
      <div className="flex flex-1 flex-col">
        <OdometerCapture
          lastReading={trip.startOdo}
          minimum={trip.startOdo}
          heading="Photograph the odometer"
          confirmLabel="End trip"
          busy={submitting || pending !== null}
          onConfirm={submit}
        />
        {error && (
          <p
            role="alert"
            data-testid="van-end-error"
            className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-400/10 dark:text-red-200"
          >
            {error}
          </p>
        )}
      </div>

      <Drawer
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DrawerContent data-testid="van-implausible-warning">
          {pending && warning && (
            <div className="mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DrawerHeader className="px-0 text-left">
                <span className="grid size-11 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  <TriangleAlert className="size-6" aria-hidden />
                </span>
                <DrawerTitle className="mt-3 text-[22px] leading-tight tracking-[-0.02em]">
                  That is {formatKm(warning.distance)} in {warning.duration}
                </DrawerTitle>
                <DrawerDescription className="text-[15px] leading-snug">
                  {warning.explanation} You started at{" "}
                  {formatOdo(trip.startOdo)} km and entered{" "}
                  {formatOdo(pending.odo)} km.
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-2.5 pb-2">
                <Button
                  size="xl"
                  className="w-full"
                  data-testid="van-warning-go-back"
                  onClick={() => setPending(null)}
                >
                  Go back and fix it
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  data-testid="van-warning-confirm"
                  disabled={submitting}
                  onClick={() =>
                    void close(pending.odo, pending.photoUrl, true)
                  }
                >
                  No, that is the reading
                </Button>
                <p className="px-2 pt-1 text-center text-xs leading-snug text-muted-foreground">
                  Confirming flags the trip for the office to check. It does not
                  stop you.
                </p>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </DriverScreen>
  );
}
