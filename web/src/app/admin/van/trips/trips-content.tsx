"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/van/van-chrome";
import { OdoPhoto } from "@/components/van/odo-photo";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatOdo } from "@/lib/van/format";

export interface AdminTripRow {
  id: string;
  date: string;
  time: string;
  endTime: string | null;
  vehicleId: string;
  vehicleName: string;
  vehicleRego: string;
  driverId: string;
  driverName: string;
  organisationId: string;
  orgLabel: string;
  purposeId: string | null;
  purposeLabel: string;
  startOdo: number;
  endOdo: number | null;
  distanceKm: number | null;
  distanceLabel: string;
  startOdoPhotoUrl: string | null;
  endOdoPhotoUrl: string | null;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  notes: string | null;
  dayKey: string;
}

export interface TripFilterOptions {
  vehicles: Array<{ id: string; name: string }>;
  drivers: Array<{ id: string; name: string }>;
  purposes: Array<{ id: string; label: string; isActive: boolean }>;
  orgLabels: string[];
}

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function VanTripsContent({
  rows,
  options,
  initialVehicleId,
}: {
  rows: AdminTripRow[];
  options: TripFilterOptions;
  initialVehicleId: string | null;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? "");
  const [driverId, setDriverId] = useState("");
  const [purposeId, setPurposeId] = useState("");
  const [orgLabel, setOrgLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<AdminTripRow | null>(null);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (vehicleId && row.vehicleId !== vehicleId) return false;
        if (driverId && row.driverId !== driverId) return false;
        if (purposeId && row.purposeId !== purposeId) return false;
        // Matched on the display label so a borrower typed in as free text
        // filters the same way a real organisation does.
        if (orgLabel && row.orgLabel !== orgLabel) return false;
        if (from && row.dayKey < from) return false;
        if (to && row.dayKey > to) return false;
        return true;
      }),
    [rows, vehicleId, driverId, purposeId, orgLabel, from, to]
  );

  const totalKm = filtered.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0);
  const openNow = filtered.filter((row) => row.status === "OPEN").length;
  const isFiltered = Boolean(
    vehicleId || driverId || purposeId || orgLabel || from || to
  );

  function exportCsv() {
    const csv = toCsv(
      [
        "Trip ID", "Date", "Start time", "End time", "Van", "Rego", "Driver",
        "Organisation", "Purpose", "Start odo (km)", "End odo (km)",
        "Distance (km)", "Start photo", "End photo", "Status", "Notes",
      ],
      filtered.map((row) => [
        row.id,
        row.date,
        row.time,
        row.endTime ?? "",
        row.vehicleName,
        row.vehicleRego,
        row.driverName,
        row.orgLabel,
        row.purposeLabel,
        row.startOdo,
        row.endOdo ?? "",
        row.distanceKm ?? "",
        row.startOdoPhotoUrl ? "yes" : "missing",
        row.endOdoPhotoUrl ? "yes" : row.status === "OPEN" ? "" : "missing",
        row.status.toLowerCase(),
        row.notes ?? "",
      ])
    );
    downloadCsv(
      `van-log-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
  }

  return (
    <div className="space-y-4" data-testid="van-trips-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm tabular-nums text-muted-foreground" data-testid="van-trips-summary">
          {filtered.length} {filtered.length === 1 ? "trip" : "trips"} ·{" "}
          {new Intl.NumberFormat("en-NZ").format(Math.round(totalKm))} km
          {openNow > 0 && ` · ${openNow} still open`}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          data-testid="van-trips-export"
        >
          <Download aria-hidden />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <select
            className={SELECT_CLASS}
            aria-label="Filter by van"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            data-testid="van-trips-filter-vehicle"
          >
            <option value="">All vans</option>
            {options.vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>

          <select
            className={SELECT_CLASS}
            aria-label="Filter by organisation"
            value={orgLabel}
            onChange={(e) => setOrgLabel(e.target.value)}
          >
            <option value="">All organisations</option>
            {options.orgLabels.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>

          <select
            className={SELECT_CLASS}
            aria-label="Filter by purpose"
            value={purposeId}
            onChange={(e) => setPurposeId(e.target.value)}
          >
            <option value="">All purposes</option>
            {options.purposes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {!p.isActive && " (retired)"}
              </option>
            ))}
          </select>

          <select
            className={SELECT_CLASS}
            aria-label="Filter by driver"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">All drivers</option>
            {options.drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="From date"
              className={SELECT_CLASS}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-[13px] text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="To date"
              className={SELECT_CLASS}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setVehicleId("");
                setDriverId("");
                setPurposeId("");
                setOrgLabel("");
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Van</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Start</TableHead>
                  <TableHead className="text-right">End</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead>Photos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{row.date}</div>
                      <div className="text-[12px] tabular-nums text-muted-foreground">
                        {row.time}
                        {row.endTime && ` – ${row.endTime}`}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.vehicleName}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.driverName}</TableCell>
                    <TableCell>{row.orgLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{row.purposeLabel}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {new Intl.NumberFormat("en-NZ").format(row.startOdo)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {row.endOdo !== null ? (
                        new Intl.NumberFormat("en-NZ").format(row.endOdo)
                      ) : (
                        <StatusPill tone="out">Open</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {row.distanceLabel}
                      {row.status === "FLAGGED" && (
                        <span
                          className="ml-1.5 align-middle text-[11px] font-bold text-amber-600 dark:text-amber-400"
                          title="Flagged for the office to check"
                        >
                          !
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* The only reason to keep a photo is so the recorded
                          number can be held against the picture, so the
                          thumbnails open both at a size you can actually read. */}
                      <button
                        type="button"
                        onClick={() => setViewing(row)}
                        aria-label={`View odometer photos for the trip on ${row.date}`}
                        data-testid={`van-trip-photos-${row.id}`}
                        className="flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-primary/10"
                      >
                        <Thumb url={row.startOdoPhotoUrl} reading={row.startOdo} />
                        <Thumb
                          url={row.endOdoPhotoUrl}
                          reading={row.endOdo}
                          open={row.status === "OPEN"}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No trips match these filters.
            </p>
          )}
        </CardContent>
      </Card>

      <PhotoViewer trip={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function PhotoViewer({
  trip,
  onClose,
}: {
  trip: AdminTripRow | null;
  onClose: () => void;
}) {
  if (!trip) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl" data-testid="van-photo-viewer">
        <DialogHeader>
          <DialogTitle>
            {trip.vehicleName} · {trip.date}
          </DialogTitle>
          <DialogDescription>
            {trip.driverName} · {trip.orgLabel} · {trip.purposeLabel} ·{" "}
            {trip.distanceLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <ViewerTile
            label="Start"
            url={trip.startOdoPhotoUrl}
            reading={trip.startOdo}
          />
          <ViewerTile
            label="End"
            url={trip.endOdoPhotoUrl}
            reading={trip.endOdo}
            open={trip.status === "OPEN"}
          />
        </div>
        {trip.notes && (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm leading-snug">
            {trip.notes}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewerTile({
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
            {" · recorded as "}
            {formatOdo(reading)} km
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function Thumb({
  url,
  reading,
  open,
}: {
  url: string | null;
  reading: number | null;
  open?: boolean;
}) {
  if (!url) {
    return (
      <span
        className={
          open
            ? "grid h-8 w-11 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground"
            : "grid h-8 w-11 place-items-center rounded bg-red-100 text-[10px] font-semibold text-red-700 dark:bg-red-400/15 dark:text-red-300"
        }
        title={open ? "Trip still open" : "No photo recorded"}
      >
        {open ? "–" : "none"}
      </span>
    );
  }
  return (
    <OdoPhoto
      url={url}
      reading={reading}
      className="h-8 w-11 overflow-hidden rounded"
    />
  );
}
