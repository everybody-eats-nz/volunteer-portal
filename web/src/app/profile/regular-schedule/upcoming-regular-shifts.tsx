"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, RefreshCw } from "lucide-react";
import { formatInNZT } from "@/lib/timezone";

type PreviewShift = {
  id: string;
  start: string;
  end: string;
  location: string;
  capacity: number;
  shiftType: {
    id: string;
    name: string;
  };
  regularStatus: string;
  isRegularShift: boolean;
};

export function UpcomingRegularShifts() {
  const [previewWeeks, setPreviewWeeks] = useState(4);

  const { data, isLoading, isValidating, mutate } = useSWR<{
    shifts?: PreviewShift[];
  }>(
    `/api/profile/regular-schedule/preview?weeks=${previewWeeks}`,
    {
      onError: (error) =>
        console.error("Failed to fetch shift preview:", error),
    }
  );
  const shifts = data?.shifts ?? [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return <Badge variant="success">Confirmed</Badge>;
      case "REGULAR_PENDING":
        return <Badge variant="warning">Auto-Applied</Badge>;
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>;
      case "WILL_AUTO_APPLY":
        return <Badge variant="secondary">Will Auto-Apply</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Regular Shifts
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={previewWeeks}
              onChange={(e) => setPreviewWeeks(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={2}>2 weeks</option>
              <option value={4}>4 weeks</option>
              <option value={8}>8 weeks</option>
              <option value={12}>12 weeks</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
            >
              <RefreshCw
                className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading upcoming shifts...
          </div>
        ) : shifts.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-muted-foreground">
              No matching shifts found for the next {previewWeeks} weeks
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              New shifts matching your regular schedule will automatically
              appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">{shift.shiftType.name}</h3>
                      {getStatusBadge(shift.regularStatus)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatInNZT(new Date(shift.start), "EEE, MMM d, yyyy")}
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatInNZT(new Date(shift.start), "h:mm a")} -{" "}
                        {formatInNZT(new Date(shift.end), "h:mm a")}
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {shift.location}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {shift.capacity} volunteers needed
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Showing {shifts.length} upcoming shift
                {shifts.length !== 1 ? "s" : ""} for the next {previewWeeks}{" "}
                weeks
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
