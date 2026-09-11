"use client";

import Link from "next/link";
import { ArrowUpRight, TriangleAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OdoPhoto } from "@/components/van/odo-photo";
import { Plate, StatusPill } from "@/components/van/van-chrome";
import { formatOdo } from "@/lib/van/format";
import { cn } from "@/lib/utils";
import type { AdminTripRow } from "./trips-content";

/**
 * One trip, in full.
 *
 * The photographs were only ever kept so the recorded number could be held
 * against the picture, so they lead. Everything the office would otherwise go
 * looking for to settle a query — who, for whom, how long, and what the rules
 * make of it — sits underneath rather than across three screens.
 */

const nf = new Intl.NumberFormat("en-NZ");

export function TripDetail({
  trip,
  onClose,
}: {
  trip: AdminTripRow | null;
  onClose: () => void;
}) {
  if (!trip) return null;

  const carried =
    trip.previousEndOdo !== null ? trip.startOdo - trip.previousEndOdo : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
        data-testid="van-photo-viewer"
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>{trip.vehicleName}</span>
            <Plate rego={trip.vehicleRego} />
            {trip.status === "OPEN" && <StatusPill tone="out" dot>Still out</StatusPill>}
            {trip.status === "FLAGGED" && (
              <StatusPill tone="warn">Confirmed over a warning</StatusPill>
            )}
          </DialogTitle>
          <DialogDescription>
            {trip.dayLabel}, {trip.time}
            {trip.endTime && ` to ${trip.endTime}`}
            {trip.durationLabel && `. Out for ${trip.durationLabel}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoTile label="Start" url={trip.startOdoPhotoUrl} reading={trip.startOdo} />
          <PhotoTile
            label="End"
            url={trip.endOdoPhotoUrl}
            reading={trip.endOdo}
            open={trip.status === "OPEN"}
          />
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
          <Field label="Driver" value={trip.driverName} />
          <Field label="Driven for" value={trip.orgLabel} />
          <Field label="Purpose" value={trip.purposeLabel} />
          <Field label="Distance" value={trip.distanceLabel} strong />
        </dl>

        {carried !== null && carried !== 0 && (
          <p
            className={cn(
              "rounded-xl px-3.5 py-2.5 text-sm leading-snug tabular-nums",
              carried < 0
                ? "bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-200"
                : "bg-amber-50 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
            )}
          >
            {carried > 0
              ? `The previous trip in this van ended at ${formatOdo(
                  trip.previousEndOdo!
                )} km, so ${nf.format(carried)} km were driven without a trip open.`
              : `The previous trip in this van ended at ${formatOdo(
                  trip.previousEndOdo!
                )} km, above the ${formatOdo(
                  trip.startOdo
                )} km this one starts at. One of the two readings is wrong.`}
          </p>
        )}

        {trip.flags.length > 0 && (
          <div className="rounded-xl border border-border p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <TriangleAlert className="size-4 text-amber-600" aria-hidden />
                What the rules make of this trip
              </h3>
              <Link
                href="/admin/van/exceptions"
                className="inline-flex items-center gap-0.5 text-[13px] font-medium text-primary underline-offset-4 hover:underline dark:text-forest-200"
              >
                All exceptions
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <ul className="mt-2 space-y-2">
              {trip.flags.map((flag) => (
                <li key={flag.kind} className="text-sm leading-snug">
                  <span className="font-medium">{flag.label}.</span>{" "}
                  <span className="text-muted-foreground">{flag.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {trip.notes && (
          <figure>
            <blockquote className="rounded-xl bg-muted px-3.5 py-2.5 text-sm leading-snug">
              {trip.notes}
            </blockquote>
            <figcaption className="mt-1.5 text-[13px] text-muted-foreground">
              Left by {trip.driverName}
            </figcaption>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="bg-card px-3.5 py-2.5">
      <dt className="text-[13px] leading-tight text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[15px] tabular-nums",
          strong ? "font-semibold" : "font-medium"
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function PhotoTile({
  label,
  url,
  reading,
  open,
}: {
  label: string;
  url: string | null;
  reading: number | null;
  open?: boolean;
}) {
  return (
    <figure>
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border">
        {url ? (
          <OdoPhoto
            url={url}
            reading={reading}
            className="size-full"
            alt={`${label} odometer`}
          />
        ) : (
          <div className="grid size-full place-items-center px-4 text-center text-sm text-muted-foreground">
            {open ? "Trip still open" : "No photo was recorded"}
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-sm">
        <span className="font-semibold">{label}</span>
        {reading !== null && (
          <span className="tabular-nums text-muted-foreground">
            {", recorded as "}
            {formatOdo(reading)} km
          </span>
        )}
      </figcaption>
    </figure>
  );
}
