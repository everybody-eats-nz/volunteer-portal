"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocationPreference } from "@/hooks/use-location-preference";
import { LocationOption } from "@/lib/locations";

interface LocationFilterTabsProps {
  locations: readonly LocationOption[];
  selectedLocation?: LocationOption;
  basePath: string;
}

export function LocationFilterTabs({
  locations,
  selectedLocation,
  basePath,
}: LocationFilterTabsProps) {
  // Auto-restore location preference on mount
  useLocationPreference(selectedLocation);

  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-sm font-medium text-muted-foreground"
        data-testid="location-filter-label"
      >
        Filter by location:
      </span>
      <Tabs value={selectedLocation || "all"} className="w-fit">
        <TabsList>
          <TabsTrigger value="all" asChild>
            <Link href={basePath} data-testid="location-filter-all">
              All
            </Link>
          </TabsTrigger>
          {locations.map((loc) => (
            <TabsTrigger key={loc} value={loc} asChild>
              <Link
                href={{ pathname: basePath, query: { location: loc } }}
                data-testid={`location-filter-${loc
                  .toLowerCase()
                  .replace(" ", "-")}`}
              >
                {loc}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
