"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Cell,
  CellGrid,
  DriverScreen,
  FlowHeader,
  StatusPill,
} from "@/components/van/van-chrome";
import { OdoPhoto } from "@/components/van/odo-photo";
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatOdo,
  formatTime,
} from "@/lib/van/format";

export interface TripScreenTrip {
  id: string;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  vehicleName: string;
  vehicleRego: string;
  driverName: string;
  orgLabel: string;
  purposeLabel: string;
  startedAt: string;
  endedAt: string | null;
  startOdo: number;
  endOdo: number | null;
  startOdoPhotoUrl: string | null;
  endOdoPhotoUrl: string | null;
  distanceKm: number | null;
  notes: string | null;
  canEdit: boolean;
}

/**
 * One trip. While it is open this is mostly one button — the note is offered
 * here, after the van is already moving, rather than anywhere near the flow
 * that got it moving.
 */
export function TripScreen({
  trip,
  justStarted,
}: {
  trip: TripScreenTrip;
  justStarted: boolean;
}) {
  const [showStarted, setShowStarted] = useState(justStarted);
  const startedAt = new Date(trip.startedAt);

  useEffect(() => {
    if (!justStarted) return;
    const id = setTimeout(() => setShowStarted(false), 4000);
    return () => clearTimeout(id);
  }, [justStarted]);

  if (trip.status === "OPEN") {
    return (
      <DriverScreen testid="van-trip-open">
        {showStarted && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
            <Check className="size-5 shrink-0" aria-hidden />
            <span className="text-sm font-semibold">
              Trip started. Drive safe.
            </span>
          </div>
        )}

        <div className="flex flex-1 flex-col">
          <div className="pt-6">
            <StatusPill tone="out" dot>
              On the road
            </StatusPill>
            <h1 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-[-0.025em]">
              {trip.vehicleName}
            </h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              {trip.orgLabel} · {trip.purposeLabel}
            </p>
          </div>

          <div className="mt-5">
            <CellGrid>
              <Cell label="Started" value={formatTime(startedAt)} />
              <Cell label="Driver" value={trip.driverName} />
              <Cell
                label="Start reading"
                value={`${formatOdo(trip.startOdo)} km`}
              />
              <Cell label="Van" value={trip.vehicleRego} />
            </CellGrid>
          </div>

          {trip.canEdit && <NoteField tripId={trip.id} initial={trip.notes} />}

          <div className="mt-auto space-y-2.5 pt-8">
            <Button
              asChild
              size="xl"
              className="w-full"
              data-testid="van-end-trip"
            >
              <Link href={`/drive/trip/${trip.id}/end`}>End trip</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="w-full">
              <Link href="/drive">My trips</Link>
            </Button>
          </div>
        </div>
      </DriverScreen>
    );
  }

  return (
    <DriverScreen testid="van-trip-closed">
      <FlowHeader backHref="/drive" />
      <div className="flex flex-1 flex-col pt-2">
        <div className="flex items-center gap-2">
          <StatusPill tone={trip.status === "FLAGGED" ? "warn" : "available"}>
            {trip.status === "FLAGGED" ? "Flagged" : "Logged"}
          </StatusPill>
          <span className="text-sm text-muted-foreground">
            {formatDateTime(startedAt)}
          </span>
        </div>

        <p
          className="mt-4 text-[54px] font-semibold leading-none tracking-[-0.035em] tabular-nums"
          data-testid="van-trip-distance"
        >
          {formatKm(trip.distanceKm ?? 0)}
        </p>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {trip.vehicleName} · {trip.orgLabel} · {trip.purposeLabel}
        </p>

        <div className="mt-6">
          <CellGrid>
            <Cell label="Start" value={`${formatOdo(trip.startOdo)} km`} />
            <Cell
              label="End"
              value={trip.endOdo !== null ? `${formatOdo(trip.endOdo)} km` : "-"}
            />
            <Cell label="Driver" value={trip.driverName} />
            <Cell
              label="Duration"
              value={
                trip.endedAt
                  ? formatDuration(startedAt, new Date(trip.endedAt))
                  : "-"
              }
            />
          </CellGrid>
        </div>

        {/* Photos sit beside the readings on purpose: the only reason to keep
            one is so the number can be held against the picture. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <PhotoTile
            label="Start"
            url={trip.startOdoPhotoUrl}
            reading={trip.startOdo}
          />
          <PhotoTile
            label="End"
            url={trip.endOdoPhotoUrl}
            reading={trip.endOdo}
          />
        </div>

        {trip.notes && (
          <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-[15px] leading-snug">
            {trip.notes}
          </p>
        )}

        <div className="mt-auto pt-8">
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/drive">Done</Link>
          </Button>
        </div>
      </div>
    </DriverScreen>
  );
}

function NoteField({
  tripId,
  initial,
}: {
  tripId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  async function save() {
    if (value === (initial ?? "")) return;
    setSaved("saving");
    try {
      await fetch(`/api/van/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      setSaved("saved");
    } catch {
      setSaved("idle");
    }
  }

  return (
    <div className="mt-5">
      <Label htmlFor="van-trip-note">Note (optional)</Label>
      <Textarea
        id="van-trip-note"
        rows={3}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved("idle");
        }}
        onBlur={() => void save()}
        placeholder="Anything worth remembering about this run"
        className="mt-1.5 text-base"
        data-testid="van-trip-note"
      />
      <p className="mt-1 h-4 text-xs text-muted-foreground" aria-live="polite">
        {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
      </p>
    </div>
  );
}

function PhotoTile({
  label,
  url,
  reading,
}: {
  label: string;
  url: string | null;
  reading: number | null;
}) {
  return (
    <figure>
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border">
        <OdoPhoto
          url={url}
          reading={url ? reading : null}
          className="size-full"
          alt={`${label} odometer`}
        />
      </div>
      <figcaption className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
        {label}
        {!url && " · missing"}
      </figcaption>
    </figure>
  );
}
