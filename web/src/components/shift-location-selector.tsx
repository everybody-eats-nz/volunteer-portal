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
    router.push(`/admin/shifts?date=${dateString}&location=${value}`);
  };

  return (
    <Select value={selectedLocation} onValueChange={handleLocationChange}>
      <SelectTrigger className="h-11 w-full bg-background sm:w-[190px]" data-testid="location-selector">
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