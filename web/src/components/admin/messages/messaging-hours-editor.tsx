"use client";

import { useCallback, useState } from "react";
import { Loader2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";

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
          toast.error(err.error ?? "Failed to save");
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
        <CardContent>
          <EmptyState
            icon={MapPin}
            title="No active locations"
            description="Configure locations under Restaurants → Restaurant Locations first."
          />
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
                  <Loader2
                    className="w-4 h-4 mr-1.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" aria-hidden="true" />
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
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2 border-b last:border-b-0 sm:grid-cols-[120px_88px_1fr_auto_1fr]"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) =>
                          updateDay(loc.location, idx, { isOpen: checked })
                        }
                        aria-label={`${loc.location} open on ${label}`}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          day.isOpen
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {day.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                    {/* Own row on phones; dissolves into the grid from sm up */}
                    <div className="col-span-2 flex items-center gap-2 sm:contents">
                      <Input
                        type="time"
                        value={day.openTime}
                        onChange={(e) =>
                          updateDay(loc.location, idx, {
                            openTime: e.target.value,
                          })
                        }
                        disabled={!day.isOpen}
                        className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                        aria-label={`${loc.location} ${label} opening time`}
                      />
                      <span
                        className="text-xs text-muted-foreground"
                        aria-hidden="true"
                      >
                        to
                      </span>
                      <Input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) =>
                          updateDay(loc.location, idx, {
                            closeTime: e.target.value,
                          })
                        }
                        disabled={!day.isOpen}
                        className="min-w-0 flex-1 sm:w-32 sm:flex-none"
                        aria-label={`${loc.location} ${label} closing time`}
                      />
                    </div>
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
