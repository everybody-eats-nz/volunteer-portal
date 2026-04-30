"use client";

import { useCallback, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface LocationHours {
  location: string;
  hours: DayHours[];
}

interface MessagingHoursEditorProps {
  initialLocations: LocationHours[];
}

const DAYS = [
  { idx: 1, label: "Monday" },
  { idx: 2, label: "Tuesday" },
  { idx: 3, label: "Wednesday" },
  { idx: 4, label: "Thursday" },
  { idx: 5, label: "Friday" },
  { idx: 6, label: "Saturday" },
  { idx: 0, label: "Sunday" },
];

export function MessagingHoursEditor({
  initialLocations,
}: MessagingHoursEditorProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const updateDay = useCallback(
    (
      location: string,
      dayOfWeek: number,
      patch: Partial<DayHours>
    ) => {
      setLocations((prev) =>
        prev.map((loc) =>
          loc.location !== location
            ? loc
            : {
                ...loc,
                hours: loc.hours.map((d) =>
                  d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d
                ),
              }
        )
      );
    },
    []
  );

  const save = useCallback(
    async (location: string, hours: DayHours[]) => {
      setSavingFor(location);
      setSaved(null);
      try {
        const res = await fetch("/api/admin/messaging-hours", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location, hours }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          alert(err.error ?? "Failed to save");
          return;
        }
        setSaved(location);
        setTimeout(() => setSaved(null), 1800);
      } finally {
        setSavingFor(null);
      }
    },
    []
  );

  if (locations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No active locations. Configure locations under Restaurants →
          Restaurant Locations first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {locations.map((loc) => (
        <Card key={loc.location}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{loc.location}</CardTitle>
            <div className="flex items-center gap-2">
              {saved === loc.location && (
                <span className="text-xs text-emerald-700">Saved</span>
              )}
              <Button
                size="sm"
                onClick={() => save(loc.location, loc.hours)}
                disabled={savingFor === loc.location}
              >
                {savingFor === loc.location ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {DAYS.map(({ idx, label }) => {
                const day = loc.hours.find((h) => h.dayOfWeek === idx)!;
                return (
                  <li
                    key={idx}
                    className="grid grid-cols-[120px_70px_1fr_auto_1fr] items-center gap-3 py-2 border-b last:border-b-0"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) =>
                          updateDay(loc.location, idx, { isOpen: checked })
                        }
                        aria-label={`${label} open`}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          day.isOpen
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        )}
                      >
                        {day.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                    <Input
                      type="time"
                      value={day.openTime}
                      onChange={(e) =>
                        updateDay(loc.location, idx, {
                          openTime: e.target.value,
                        })
                      }
                      disabled={!day.isOpen}
                      className="w-32"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.closeTime}
                      onChange={(e) =>
                        updateDay(loc.location, idx, {
                          closeTime: e.target.value,
                        })
                      }
                      disabled={!day.isOpen}
                      className="w-32"
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
