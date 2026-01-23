"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInNZT } from "@/lib/timezone";

interface Signup {
  id: string;
  status: string;
  shift: {
    start: Date;
    end: Date;
    location: string | null;
    shiftType: {
      name: string;
    };
  };
}

interface ShiftHistoryPaginatedProps {
  signups: Signup[];
  volunteerId: string;
  selectedLocation?: string;
  itemsPerPage?: number;
}

export function ShiftHistoryPaginated({
  signups,
  selectedLocation,
  itemsPerPage = 10,
}: ShiftHistoryPaginatedProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const now = new Date();

  const totalPages = Math.ceil(signups.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSignups = signups.slice(startIndex, endIndex);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
      (page) => {
        if (page === 1 || page === totalPages) return true;
        if (Math.abs(page - currentPage) <= 1) return true;
        return false;
      }
    );

    showPages.forEach((page, idx) => {
      if (idx > 0) {
        const prev = showPages[idx - 1];
        if (page - prev > 1) {
          pages.push("ellipsis");
        }
      }
      pages.push(page);
    });

    return pages;
  };

  if (signups.length === 0) {
    return (
      <div className="text-center py-8" data-testid="shift-history-empty-state">
        <Clock className="h-12 w-12 text-muted-foreground/30 dark:text-muted-foreground/50 mx-auto mb-4" />
        <p className="text-muted-foreground">
          {selectedLocation
            ? `No shift signups found for ${selectedLocation}`
            : "No shift signups yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="shift-history-list">
      {currentSignups.map((signup) => (
        <div
          key={signup.id}
          className="flex items-center justify-between p-4 bg-muted/30 dark:bg-muted/20 rounded-lg hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold">{signup.shift.shiftType.name}</h4>
              {signup.shift.location && (
                <Badge variant="outline">
                  <MapPin className="h-3 w-3 mr-1" />
                  {signup.shift.location}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatInNZT(signup.shift.start, "EEE dd MMM yyyy")}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatInNZT(signup.shift.start, "h:mma")} –{" "}
                {formatInNZT(signup.shift.end, "h:mma")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                signup.status === "CONFIRMED"
                  ? "default"
                  : signup.status === "WAITLISTED"
                  ? "secondary"
                  : "outline"
              }
              className={cn(
                signup.status === "CONFIRMED" &&
                  "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30",
                signup.status === "PENDING" &&
                  "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
                signup.status === "WAITLISTED" &&
                  "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/30",
                signup.status === "CANCELED" &&
                  "bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30",
                signup.status === "NO_SHOW" &&
                  "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30"
              )}
            >
              {signup.status === "CONFIRMED" && "Confirmed"}
              {signup.status === "PENDING" && "Pending"}
              {signup.status === "WAITLISTED" && "Waitlisted"}
              {signup.status === "CANCELED" && "Canceled"}
              {signup.status === "NO_SHOW" && "No-show"}
              {signup.status === "REGULAR_PENDING" && "Auto-Applied"}
            </Badge>
            {signup.shift.start < now && (
              <Badge variant="outline" className="text-muted-foreground">
                Past
              </Badge>
            )}
          </div>
        </div>
      ))}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {signups.length} shifts
            {selectedLocation && ` in ${selectedLocation}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8",
                currentPage <= 1 && "pointer-events-none opacity-50"
              )}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page Numbers */}
            {getPageNumbers().map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={currentPage === item ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8",
                currentPage >= totalPages && "pointer-events-none opacity-50"
              )}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
