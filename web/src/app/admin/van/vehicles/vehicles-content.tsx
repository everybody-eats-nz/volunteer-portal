"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cell, CellGrid, StatusPill } from "@/components/van/van-chrome";
import { formatKm, formatOdo } from "@/lib/van/format";

export interface AdminVehicle {
  id: string;
  name: string;
  rego: string;
  homeCity: string;
  photoUrl: string | null;
  currentOdo: number;
  isActive: boolean;
  ownerOrgId: string;
  ownerOrgName: string;
  tripCount: number;
  loggedKm: number;
  status: "in" | "out" | "overdue";
  holderName: string | null;
}

export function VanVehiclesContent({
  vehicles,
  organisations,
  stickerBaseUrl,
}: {
  vehicles: AdminVehicle[];
  organisations: Array<{ id: string; name: string }>;
  stickerBaseUrl: string;
}) {
  const router = useRouter();
  const [sticker, setSticker] = useState<AdminVehicle | null>(null);
  const [editing, setEditing] = useState<AdminVehicle | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4" data-testid="van-vehicles-page">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} data-testid="van-vehicle-add">
          <Plus aria-hidden />
          Add a van
        </Button>
      </div>

      <ul className="grid gap-4 lg:grid-cols-2">
        {vehicles.map((vehicle) => (
          <li key={vehicle.id}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold leading-tight">
                        {vehicle.name}
                      </h2>
                      {vehicle.status === "overdue" ? (
                        <StatusPill tone="danger" dot>Overdue</StatusPill>
                      ) : vehicle.status === "out" ? (
                        <StatusPill tone="out" dot>Out</StatusPill>
                      ) : (
                        <StatusPill tone="available" dot>In</StatusPill>
                      )}
                      {!vehicle.isActive && (
                        <StatusPill tone="neutral">Retired</StatusPill>
                      )}
                    </div>
                    <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                      {vehicle.rego} · {vehicle.homeCity} · {vehicle.ownerOrgName}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(vehicle)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSticker(vehicle)}
                      data-testid={`van-vehicle-sticker-${vehicle.id}`}
                    >
                      <QrCode aria-hidden />
                      Sticker
                    </Button>
                  </div>
                </div>

                {vehicle.photoUrl && (
                  <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                    <Image
                      src={vehicle.photoUrl}
                      alt={`${vehicle.name}, registration ${vehicle.rego}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 480px"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="mt-4">
                  <CellGrid>
                    <Cell
                      label="Odometer"
                      value={`${formatOdo(vehicle.currentOdo)} km`}
                    />
                    <Cell label="Logged here" value={formatKm(vehicle.loggedKm)} />
                  </CellGrid>
                </div>

                <p className="mt-3 text-[13px] text-muted-foreground">
                  {vehicle.holderName ? (
                    <>
                      Out with{" "}
                      <strong className="font-semibold text-foreground">
                        {vehicle.holderName}
                      </strong>
                    </>
                  ) : (
                    "Available"
                  )}
                  {" · "}
                  <Link
                    href={`/admin/van/trips?vehicle=${vehicle.id}`}
                    className="font-semibold text-primary hover:underline dark:text-forest-200"
                  >
                    {vehicle.tripCount} trips
                  </Link>
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {vehicles.length === 0 && (
        <p className="rounded-xl bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
          No vans yet. Add one, then print its sticker for the dashboard.
        </p>
      )}

      {sticker && (
        <StickerDialog
          vehicle={sticker}
          url={`${stickerBaseUrl}/v/${sticker.id}`}
          onClose={() => setSticker(null)}
        />
      )}

      {(editing || creating) && (
        <VehicleDialog
          vehicle={editing}
          organisations={organisations}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** What actually gets stuck to the dashboard. Printable at roughly A6. */
function StickerDialog({
  vehicle,
  url,
  onClose,
}: {
  vehicle: AdminVehicle;
  url: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sticker for {vehicle.name}</DialogTitle>
          <DialogDescription>
            The QR code points at the van&rsquo;s id, not its rego, so renaming
            the van or changing its plate never invalidates a sticker already on
            a dashboard.
          </DialogDescription>
        </DialogHeader>

        <div
          id="van-sticker-printable"
          className="rounded-xl bg-white px-5 py-6 text-center ring-1 ring-forest-500/15"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest-500">
            Everybody Eats · Van Log
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-forest-700">
            {vehicle.name}
          </h3>
          <p className="text-sm tabular-nums text-forest-600/70">{vehicle.rego}</p>
          <div className="mt-4 flex justify-center">
            <QRCodeSVG
              value={url}
              size={192}
              level="M"
              bgColor="#ffffff"
              fgColor="#1d5337"
            />
          </div>
          <p className="mt-4 text-[15px] font-semibold leading-snug text-forest-700">
            Scan before you drive.
            <br />
            Scan again when you get back.
          </p>
        </div>

        <p className="break-all text-center text-[11px] text-muted-foreground">
          {url}
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden />
            Print sticker
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VehicleDialog({
  vehicle,
  organisations,
  onClose,
  onSaved,
}: {
  vehicle: AdminVehicle | null;
  organisations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(vehicle?.name ?? "");
  const [rego, setRego] = useState(vehicle?.rego ?? "");
  const [homeCity, setHomeCity] = useState(vehicle?.homeCity ?? "");
  const [photoUrl, setPhotoUrl] = useState(vehicle?.photoUrl ?? "");
  const [ownerOrgId, setOwnerOrgId] = useState(
    vehicle?.ownerOrgId ?? organisations[0]?.id ?? ""
  );
  const [busy, setBusy] = useState(false);

  const valid =
    name.trim().length >= 2 &&
    rego.trim().length >= 2 &&
    homeCity.trim().length >= 2 &&
    ownerOrgId;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/van/vehicles", {
        method: vehicle ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(vehicle ? { id: vehicle.id } : {}),
          name: name.trim(),
          rego: rego.trim(),
          homeCity: homeCity.trim(),
          photoUrl: photoUrl.trim() || null,
          ownerOrgId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? "Could not save that.");
        return;
      }
      toast.success(vehicle ? "Van updated" : "Van added");
      onSaved();
    } catch {
      toast.error("No connection. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vehicle ? `Edit ${vehicle.name}` : "Add a van"}</DialogTitle>
          <DialogDescription>
            Drivers see the name and rego on the status page the sticker opens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="van-name">Name</Label>
            <Input
              id="van-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kai Van"
              className="mt-1.5"
              data-testid="van-vehicle-name"
            />
          </div>
          <div>
            <Label htmlFor="van-rego">Registration</Label>
            <Input
              id="van-rego"
              value={rego}
              onChange={(e) => setRego(e.target.value)}
              placeholder="GNP417"
              className="mt-1.5 uppercase"
              data-testid="van-vehicle-rego"
            />
          </div>
          <div>
            <Label htmlFor="van-city">City</Label>
            <Input
              id="van-city"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              placeholder="Wellington"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="van-owner">Belongs to</Label>
            <select
              id="van-owner"
              value={ownerOrgId}
              onChange={(e) => setOwnerOrgId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="van-photo">Photo URL</Label>
            <Input
              id="van-photo"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="/van-placeholder.svg"
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={() => void save()}
            data-testid="van-vehicle-save"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
