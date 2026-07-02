"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Globe, MapPin, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Serializable subset of LiveLocation passed down from server components. */
export interface SwitcherLocation {
  name: string;
  isNew: boolean;
}

const slugify = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/**
 * The shifts page title doubled as a location switcher: the heading itself
 * opens a dropdown of live locations, with an explicit "Change location"
 * pill so it's obvious the title is interactive.
 *
 * Rendered inside PageHeader's h1, so the trigger inherits the heading type
 * (via [font:inherit]) and keeps heading semantics; the menu itself portals
 * out to <body>.
 *
 * Newly launched locations carry a "New" badge, and the pill shows a green
 * dot for as long as any location is within its launch window - quiet by
 * design, no notifications.
 */
export function LocationSwitcher({
  locations,
  selectedLocation,
  showAll,
  isLoggedIn,
  userDefaultLocation,
}: {
  locations: SwitcherLocation[];
  selectedLocation?: string;
  showAll: boolean;
  isLoggedIn: boolean;
  userDefaultLocation: string | null;
}) {
  const router = useRouter();
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  const hasNewLocation = locations.some((l) => l.isNew);

  const switchTo = (location: string | null) => {
    router.push(
      location === null
        ? "/shifts?showAll=true"
        : `/shifts?location=${encodeURIComponent(location)}`
    );
  };

  const canSetDefault =
    isLoggedIn && !!selectedLocation && selectedLocation !== userDefaultLocation;

  const setAsDefault = async () => {
    if (!selectedLocation || isSavingDefault) return;
    setIsSavingDefault(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLocation: selectedLocation }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedLocation} is now your default location`);
      router.refresh();
    } catch (error) {
      console.error("Failed to set default location:", error);
      toast.error("Couldn't save your default location. Please try again.");
    } finally {
      setIsSavingDefault(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg text-left [font:inherit] tracking-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="location-switcher-trigger"
        >
          <span>{showAll ? "All locations" : selectedLocation ?? "Shifts"}</span>
          <span className="relative inline-flex translate-y-[-0.2em] items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-foreground sm:text-sm">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            Change location
            {hasNewLocation && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                data-testid="location-switcher-new-dot"
                aria-hidden
              />
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {locations.map((location) => {
          const isSelected = !showAll && location.name === selectedLocation;
          return (
            <DropdownMenuItem
              key={location.name}
              onSelect={() => switchTo(location.name)}
              className="gap-3 py-2.5"
              data-testid={`location-switcher-option-${slugify(location.name)}`}
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium">{location.name}</span>
                {location.isNew && (
                  <Badge
                    className="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                    data-testid={`location-new-badge-${slugify(location.name)}`}
                  >
                    New
                  </Badge>
                )}
                {location.name === userDefaultLocation && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Default
                  </span>
                )}
              </span>
              {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem
          onSelect={() => switchTo(null)}
          className="gap-3 py-2.5"
          data-testid="location-switcher-all"
        >
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 font-medium">All locations</span>
          {showAll && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </DropdownMenuItem>
        {canSetDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void setAsDefault();
              }}
              disabled={isSavingDefault}
              className="gap-3 py-2.5 text-muted-foreground"
              data-testid="location-switcher-set-default"
            >
              <Star className="h-4 w-4 shrink-0" />
              <span>Make {selectedLocation} my default</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
