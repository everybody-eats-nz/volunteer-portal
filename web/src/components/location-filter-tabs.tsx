"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const router = useRouter();

  // Auto-restore location preference on mount
  useLocationPreference(selectedLocation);

  const handleLocationChange = (value: string) => {
    if (value === "all") {
      router.push(basePath);
    } else {
      router.push(`${basePath}?location=${value}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-sm font-medium text-muted-foreground whitespace-nowrap"
        data-testid="location-filter-label"
      >
        Location:
      </span>
      <Select
        value={selectedLocation || "all"}
        onValueChange={handleLocationChange}
      >
        <SelectTrigger
          className="w-[180px] h-9 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
          data-testid="location-filter-all"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" data-testid="location-filter-all-option">
            All locations
          </SelectItem>
          {locations.map((loc) => (
            <SelectItem
              key={loc}
              value={loc}
              data-testid={`location-filter-${loc
                .toLowerCase()
                .replace(" ", "-")}`}
            >
              {loc}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
