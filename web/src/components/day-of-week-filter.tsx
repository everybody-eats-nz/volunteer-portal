"use client";

import { Label } from "@/components/ui/label";

const DAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];

interface DayOfWeekFilterProps {
  value: string; // comma-separated day numbers e.g. "1,3,5"
  onChange: (value: string) => void;
}

export function DayOfWeekFilter({ value, onChange }: DayOfWeekFilterProps) {
  const selected = new Set(value ? value.split(",") : []);

  const toggle = (day: string) => {
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange(Array.from(next).sort().join(","));
  };

  return (
    <div className="space-y-2">
      <Label>Day of Week</Label>
      <div className="flex gap-1">
        {DAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              selected.has(day.value)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            {day.label}
          </button>
        ))}
      </div>
    </div>
  );
}

