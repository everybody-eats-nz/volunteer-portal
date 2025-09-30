"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const handleLocationChange = (value: string) => {
    router.push(`/admin/shifts?date=${dateString}&location=${value}`);
  };

  return (
    <Select value={selectedLocation} onValueChange={handleLocationChange}>
      <SelectTrigger className="w-[200px] h-11 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700" data-testid="location-selector">
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