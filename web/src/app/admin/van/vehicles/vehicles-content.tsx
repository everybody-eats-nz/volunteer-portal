"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Archive,
  ArrowUpRight,
  Building2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VanPhotoField } from "@/components/van/van-photo-field";
import { formatKm, formatOdo } from "@/lib/van/format";
import { canOptimiseImage } from "@/lib/van/images";
import { cn } from "@/lib/utils";

export type VehicleStatus = "in" | "out" | "overdue" | "retired";

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
  status: VehicleStatus;
  holderName: string | null;
  /** "since 2:40pm" — already in NZ time. Null unless the van is out. */
  outSinceLabel: string | null;
  /** "3 Sep 2026" — the last trip that started, ever. */
  lastUsedLabel: string | null;
}

type Filter = "all" | "in" | "out" | "overdue";

const ALL_CITIES = "__all__";

/* -------------------------------------------------------------------------- */
/*  Small brand pieces                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The rego, set as a number plate.
 *
 * It is the only identifier shared by the van, the paper book it replaced and
 * the person standing next to it, so it is worth being recognisable at a glance
 * rather than another line of grey metadata.
 */
function Plate({
  rego,
  className,
}: {
  rego: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // White rather than cream: it sits on the pale empty frame as often as
        // on a photo, and cream on cream is not a plate.
        "inline-flex items-center rounded-[6px] bg-white px-2 py-[3px] text-[13px] font-bold uppercase leading-none tracking-[0.14em] text-forest-700 tabular-nums ring-1 ring-inset ring-forest-700/40",
        className
      )}
    >
      {rego}
    </span>
  );
}

/**
 * Status, set to sit on top of a photograph.
 *
 * The shared `StatusPill` is tuned for a card surface and leans on translucent
 * fills, which stop reading once there is a photo of a white van behind them.
 * These are opaque on purpose, and each pairs its colour with a word.
 */
const OVERLAY_TONES: Record<VehicleStatus, string> = {
  in: "bg-cream-50/95 text-forest-700 ring-forest-700/15",
  out: "bg-amber-400/95 text-amber-950 ring-amber-900/20",
  overdue: "bg-red-600/95 text-white ring-red-900/30",
  retired: "bg-forest-800/85 text-cream-50/90 ring-cream-50/25",
};

const STATUS_WORD: Record<VehicleStatus, string> = {
  in: "In the depot",
  out: "Out now",
  overdue: "Overdue",
  retired: "Retired",
};

function OverlayStatus({ status }: { status: VehicleStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-sm ring-1 ring-inset backdrop-blur-sm",
        OVERLAY_TONES[status]
      )}
    >
      {status === "overdue" ? (
        <TriangleAlert className="size-3" aria-hidden />
      ) : (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {STATUS_WORD[status]}
    </span>
  );
}

/** Reserved 16:9 frame, so a van with no photo leaves no hole in the grid. */
function VanFrame({
  vehicle,
  className,
  sizes,
}: {
  vehicle: AdminVehicle;
  className?: string;
  sizes: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-forest-500/[0.06] dark:bg-cream-50/[0.05]",
        className
      )}
    >
      {vehicle.photoUrl ? (
        <Image
          src={vehicle.photoUrl}
          alt={`${vehicle.name}, registration ${vehicle.rego}`}
          fill
          sizes={sizes}
          unoptimized={!canOptimiseImage(vehicle.photoUrl)}
          className={cn(
            "object-cover",
            vehicle.status === "retired" && "opacity-60 grayscale"
          )}
        />
      ) : (
        // The brand's own van mark rather than a generic truck glyph: the two
        // sit side by side in the grid whenever some vans have photos and
        // others do not, and two different drawings of a van read as a bug.
        <Image
          src="/van-placeholder.svg"
          alt=""
          fill
          sizes={sizes}
          aria-hidden
          className="object-contain p-[10%] opacity-30 dark:opacity-25"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

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
  const [retiring, setRetiring] = useState<AdminVehicle | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(ALL_CITIES);
  const [showRetired, setShowRetired] = useState(false);

  const active = useMemo(
    () => vehicles.filter((v) => v.status !== "retired"),
    [vehicles]
  );
  const retired = useMemo(
    () => vehicles.filter((v) => v.status === "retired"),
    [vehicles]
  );

  const counts = useMemo(
    () => ({
      all: active.length,
      in: active.filter((v) => v.status === "in").length,
      out: active.filter((v) => v.status === "out").length,
      overdue: active.filter((v) => v.status === "overdue").length,
      km: vehicles.reduce((sum, v) => sum + v.loggedKm, 0),
    }),
    [active, vehicles]
  );

  const cities = useMemo(
    () => [...new Set(vehicles.map((v) => v.homeCity))].sort(),
    [vehicles]
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return active.filter((vehicle) => {
      if (filter !== "all" && vehicle.status !== filter) return false;
      if (city !== ALL_CITIES && vehicle.homeCity !== city) return false;
      if (!needle) return true;
      return [
        vehicle.name,
        vehicle.rego,
        vehicle.homeCity,
        vehicle.ownerOrgName,
        vehicle.holderName ?? "",
      ].some((field) => field.toLowerCase().includes(needle));
    });
  }, [active, filter, city, query]);

  const filtered = filter !== "all" || city !== ALL_CITIES || query.trim() !== "";

  function clearFilters() {
    setFilter("all");
    setCity(ALL_CITIES);
    setQuery("");
  }

  async function setActive(vehicle: AdminVehicle, isActive: boolean) {
    const response = await fetch("/api/admin/van/vehicles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: vehicle.id, isActive }),
    }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    if (!response?.ok) {
      toast.error(data?.error ?? "Could not save that.");
      return;
    }
    toast.success(isActive ? `${vehicle.name} is back in the fleet` : `${vehicle.name} retired`);
    router.refresh();
  }

  return (
    <div className="space-y-6" data-testid="van-vehicles-page">
      <FleetBoard
        counts={counts}
        filter={filter}
        onFilter={(next) => setFilter((current) => (current === next ? "all" : next))}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, rego, city, driver"
            aria-label="Search vans"
            data-testid="van-vehicle-search"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>

        {cities.length > 1 && (
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger
              className="w-full lg:w-44"
              aria-label="Filter by depot"
              data-testid="van-vehicle-city-filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CITIES}>All cities</SelectItem>
              {cities.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {retired.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id="van-show-retired"
              checked={showRetired}
              onCheckedChange={setShowRetired}
              data-testid="van-show-retired"
            />
            <Label
              htmlFor="van-show-retired"
              className="cursor-pointer whitespace-nowrap text-sm font-normal text-muted-foreground"
            >
              Show retired ({retired.length})
            </Label>
          </div>
        )}

        <Button
          onClick={() => setCreating(true)}
          data-testid="van-vehicle-add"
          className="lg:ml-auto"
        >
          <Plus aria-hidden />
          Add a van
        </Button>
      </div>

      {matches.length > 0 && (
        <>
          <div className="flex items-baseline gap-3 text-sm text-muted-foreground">
            <span>
              {filtered
                ? `${matches.length} of ${active.length} vans`
                : `${active.length} ${active.length === 1 ? "van" : "vans"} in the fleet`}
            </span>
            {filtered && (
              <button
                type="button"
                onClick={clearFilters}
                className="font-semibold text-primary hover:underline dark:text-forest-200"
              >
                Clear filters
              </button>
            )}
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map((vehicle) => (
              <VanCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={() => setEditing(vehicle)}
                onSticker={() => setSticker(vehicle)}
                onRetire={() => setRetiring(vehicle)}
              />
            ))}
          </ul>
        </>
      )}

      {matches.length === 0 && (
        <EmptyState
          filtered={filtered}
          onClear={clearFilters}
          onAdd={() => setCreating(true)}
        />
      )}

      {showRetired && retired.length > 0 && (
        <section className="space-y-3 pt-2" data-testid="van-retired-list">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Retired
            </h2>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <p className="text-sm text-muted-foreground">
            Kept for the record: their trips still count towards the mileage
            report, but drivers can no longer take them out.
          </p>
          <ul className="space-y-2">
            {retired.map((vehicle) => (
              <li
                key={vehicle.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-forest-500/[0.04] p-3 dark:bg-cream-50/[0.04]"
              >
                <VanFrame
                  vehicle={vehicle}
                  sizes="80px"
                  className="h-12 w-20 shrink-0 rounded-lg ring-1 ring-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{vehicle.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {vehicle.homeCity} · {vehicle.tripCount}{" "}
                    {vehicle.tripCount === 1 ? "trip" : "trips"} ·{" "}
                    {vehicle.lastUsedLabel
                      ? `last out ${vehicle.lastUsedLabel}`
                      : "never used"}
                  </p>
                </div>
                <Plate rego={vehicle.rego} className="opacity-70" />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(vehicle)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void setActive(vehicle, true)}
                  >
                    <RotateCcw aria-hidden />
                    Restore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
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
          cities={cities}
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

      <AlertDialog
        open={retiring !== null}
        onOpenChange={(open) => !open && setRetiring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire {retiring?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the driver&rsquo;s van picker and its sticker
              stops working, but every trip it has already logged stays in the
              record. You can put it back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (retiring) void setActive(retiring, false);
                setRetiring(null);
              }}
            >
              Retire the van
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fleet board                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The four questions the office actually opens this page with — how many vans
 * are there, which are sitting idle, which are out, and is anything late back —
 * answered above the fold and doubling as the filter for the grid below.
 */
function FleetBoard({
  counts,
  filter,
  onFilter,
}: {
  counts: { all: number; in: number; out: number; overdue: number; km: number };
  filter: Filter;
  onFilter: (next: Filter) => void;
}) {
  const tiles: Array<{
    key: Filter;
    label: string;
    value: number;
    sub: string;
    alarm?: boolean;
  }> = [
    {
      key: "all",
      label: "In the fleet",
      value: counts.all,
      sub: `${formatKm(counts.km)} logged`,
    },
    {
      key: "in",
      label: "In the depot",
      value: counts.in,
      sub: "ready to go",
    },
    {
      key: "out",
      label: "Out now",
      value: counts.out,
      sub: "on the road",
    },
    {
      key: "overdue",
      label: "Overdue back",
      value: counts.overdue,
      sub: counts.overdue > 0 ? "needs a chase" : "all accounted for",
      alarm: counts.overdue > 0,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Filter vans by status"
      data-testid="van-fleet-board"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-forest-500/15 ring-1 ring-forest-500/15 lg:grid-cols-4 dark:bg-cream-50/15 dark:ring-cream-50/15"
    >
      {tiles.map((tile) => {
        const selected = filter === tile.key;
        return (
          <button
            key={tile.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onFilter(tile.key)}
            data-testid={`van-fleet-${tile.key}`}
            className={cn(
              "grain relative px-5 py-5 text-left transition-colors sm:px-7 sm:py-6",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50",
              selected
                ? "bg-forest-500 text-cream-50 dark:bg-forest-300 dark:text-forest-800"
                : "bg-background hover:bg-forest-500/[0.06] dark:hover:bg-cream-50/[0.06]"
            )}
          >
            {selected && (
              <span
                className="absolute inset-x-0 top-0 h-1 bg-sun-200"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "display block text-4xl tracking-tight tabular-nums sm:text-5xl",
                selected
                  ? "text-current"
                  : tile.alarm
                    ? "text-red-600 dark:text-red-400"
                    : "text-forest-700 dark:text-cream-50"
              )}
            >
              {tile.value}
            </span>
            <span
              className={cn(
                "mt-2 block text-[0.65rem] uppercase tracking-[0.15em] sm:text-xs",
                selected
                  ? "text-current/80"
                  : "text-forest-500/70 dark:text-cream-50/55"
              )}
            >
              {tile.label}
            </span>
            <span
              className={cn(
                "mt-1 block truncate text-xs",
                selected
                  ? "text-current/70"
                  : "text-forest-500/70 dark:text-cream-50/55"
              )}
            >
              {tile.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Van card                                                                  */
/* -------------------------------------------------------------------------- */

function VanCard({
  vehicle,
  onEdit,
  onSticker,
  onRetire,
}: {
  vehicle: AdminVehicle;
  onEdit: () => void;
  onSticker: () => void;
  onRetire: () => void;
}) {
  return (
    <li
      data-testid={`van-vehicle-card-${vehicle.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        vehicle.status === "overdue" &&
          "border-red-500/40 ring-1 ring-red-500/20"
      )}
    >
      <div className="relative">
        <VanFrame
          vehicle={vehicle}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 360px"
          className="aspect-[16/9] w-full"
        />
        {/* Enough of a scrim for a white plate on a white van. Only over a real
            photo — on the empty frame it just muddies the mark. */}
        {vehicle.photoUrl && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-forest-800/45 to-transparent"
            aria-hidden
          />
        )}
        <div className="absolute left-3 top-3">
          <OverlayStatus status={vehicle.status} />
        </div>
        <div className="absolute bottom-3 left-3">
          <Plate rego={vehicle.rego} className="shadow-md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="display display-medium truncate text-xl leading-tight text-forest-700 dark:text-cream-50">
              {vehicle.name}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {vehicle.homeCity}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1">
                <Building2 className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{vehicle.ownerOrgName}</span>
              </span>
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
                aria-label={`More actions for ${vehicle.name}`}
                data-testid={`van-vehicle-menu-${vehicle.id}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onSticker}>
                <QrCode aria-hidden />
                Print the sticker
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/van/trips?vehicle=${vehicle.id}`}>
                  <ArrowUpRight aria-hidden />
                  See its trips
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRetire}>
                <Archive aria-hidden />
                Retire this van
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border">
          <Metric label="Odometer" value={`${formatOdo(vehicle.currentOdo)} km`} />
          <Metric label="Logged" value={formatKm(vehicle.loggedKm)} />
          <Metric
            label="Trips"
            value={String(vehicle.tripCount)}
            href={
              vehicle.tripCount > 0
                ? `/admin/van/trips?vehicle=${vehicle.id}`
                : undefined
            }
          />
        </dl>

        <p
          className={cn(
            "mt-auto text-[13px] leading-snug",
            vehicle.status === "overdue"
              ? "font-medium text-red-700 dark:text-red-300"
              : "text-muted-foreground"
          )}
        >
          {vehicle.holderName ? (
            <>
              {vehicle.status === "overdue" ? "Still out with " : "Out with "}
              <strong
                className={cn(
                  "font-semibold",
                  vehicle.status === "overdue" ? "" : "text-foreground"
                )}
              >
                {vehicle.holderName}
              </strong>
              {vehicle.outSinceLabel ? ` ${vehicle.outSinceLabel}` : ""}
            </>
          ) : vehicle.lastUsedLabel ? (
            <>Parked up · last out {vehicle.lastUsedLabel}</>
          ) : (
            <>Parked up · never taken out yet</>
          )}
        </p>

        <div className="flex gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onSticker}
            data-testid={`van-vehicle-sticker-${vehicle.id}`}
          >
            <QrCode aria-hidden />
            Sticker
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onEdit}
            data-testid={`van-vehicle-edit-${vehicle.id}`}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
        </div>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="bg-card px-2.5 py-2.5 sm:px-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      {/* Three figures across a phone-width card: a hair smaller than the body
          text so a six-figure odometer is not truncated to "150,850 k…". */}
      <dd className="mt-0.5 truncate text-[13px] font-semibold tabular-nums sm:text-sm">
        {href ? (
          <Link
            href={href}
            className="text-primary hover:underline dark:text-forest-200"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function EmptyState({
  filtered,
  onClear,
  onAdd,
}: {
  filtered: boolean;
  onClear: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="grain rounded-2xl border border-dashed border-forest-500/25 bg-forest-500/[0.03] px-6 py-14 text-center dark:border-cream-50/20 dark:bg-cream-50/[0.03]">
      <Truck
        className="mx-auto size-10 text-forest-500/30 dark:text-cream-50/25"
        aria-hidden
      />
      <p className="mt-4 text-base font-semibold">
        {filtered ? "No vans match that" : "No vans yet"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Try a different search, or widen the filters."
          : "Add the first van, then print its sticker for the dashboard so drivers can scan it before they set off."}
      </p>
      <div className="mt-5">
        {filtered ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <Button onClick={onAdd}>
            <Plus aria-hidden />
            Add a van
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialogs                                                                   */
/* -------------------------------------------------------------------------- */

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
          {/* The same plate the fleet list shows, so the sticker on the
              dashboard and the card in the office read as the same van. */}
          <div className="mt-1.5 flex justify-center">
            <Plate rego={vehicle.rego} />
          </div>
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
  cities,
  onClose,
  onSaved,
}: {
  vehicle: AdminVehicle | null;
  organisations: Array<{ id: string; name: string }>;
  cities: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(vehicle?.name ?? "");
  const [rego, setRego] = useState(vehicle?.rego ?? "");
  const [homeCity, setHomeCity] = useState(vehicle?.homeCity ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    vehicle?.photoUrl ?? null
  );
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
          photoUrl: photoUrl?.trim() || null,
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vehicle ? `Edit ${vehicle.name}` : "Add a van"}
          </DialogTitle>
          <DialogDescription>
            Drivers see the photo, name and rego on the status page the sticker
            opens — enough to be sure they scanned the right van.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          {/* The photo and "belongs to" share a column so the two halves of the
              form end at roughly the same height; a lone 16:9 frame next to
              four stacked fields leaves an obvious hole. */}
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 block">
                Photo{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <VanPhotoField
                value={photoUrl}
                onChange={setPhotoUrl}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="van-owner">Belongs to</Label>
              <select
                id="van-owner"
                value={ownerOrgId}
                onChange={(e) => setOwnerOrgId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                data-testid="van-vehicle-owner"
              >
                {organisations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
                onChange={(e) => setRego(e.target.value.toUpperCase())}
                placeholder="GNP417"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 font-semibold uppercase tracking-[0.14em] tabular-nums"
                data-testid="van-vehicle-rego"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Spaces and case are ignored when checking for duplicates.
              </p>
            </div>
            <div>
              <Label htmlFor="van-city">City</Label>
              <Input
                id="van-city"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                placeholder="Wellington"
                list="van-city-options"
                className="mt-1.5"
                data-testid="van-vehicle-city"
              />
              <datalist id="van-city-options">
                {cities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </div>
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid || busy}
              data-testid="van-vehicle-save"
            >
              {vehicle ? "Save changes" : "Add the van"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
