"use client";

import { useRouter } from "next/navigation";
import { useLocationPreference } from "@/hooks/use-location-preference";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationOption } from "@/lib/locations";

interface ShiftLocationSelectorProps {
  selectedLocation: string;
  dateString: string;
  locations: readonly string[];
}

export function ShiftLocationSelector({
  selectedLocation,
  dateString,
  locations,
}: ShiftLocationSelectorProps) {
  const router = useRouter();

  // Auto-restore location preference on mount
  useLocationPreference(selectedLocation as LocationOption);

  const handleLocationChange = (value: string) => {
    // Location names are free text: interpolating one straight into the query
    // string breaks on any name containing "&" or "#". encodeURIComponent
    // rather than URLSearchParams, which would spell spaces as "+".
    router.push(
      `/admin/shifts?date=${dateString}&location=${encodeURIComponent(value)}`
    );
  };

  return (
    <Select value={selectedLocation} onValueChange={handleLocationChange}>
      {/* Pop-up venues carry the whole event in their name ("The Gathered Table
          Event: Britomart Hotel"), which a fixed 190px trigger cut mid-word.
          Short names keep that width; longer ones grow to a readable cap.
          The value is forced back to a block so it truncates with an ellipsis
          instead of being hard-clipped by the trigger's flex layout, and the
          full name stays available on hover. */}
      <SelectTrigger
        className="h-11 w-full bg-background sm:w-auto sm:min-w-[190px] sm:max-w-[22rem] *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate"
        title={selectedLocation}
        data-testid="location-selector"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locations.map((location) => (
          <SelectItem key={location} value={location}>
            {location}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}