import { addDays, subDays } from "date-fns";
import { formatInNZT, parseISOInNZT } from "@/lib/timezone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  MapPin,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ShiftsProfileCompletionBanner } from "@/components/shifts-profile-completion-banner";
import { ShiftDetailsContent } from "./shift-details-content";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  LOCATION_ADDRESSES,
  Location,
  getLocationMapsUrl,
} from "@/lib/locations";

export default async function ShiftDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const locationParam = Array.isArray(params.location)
    ? params.location[0]
    : params.location;

  if (!dateParam) {
    return (
      <PageContainer>
        <div className="text-center py-20">
          <Calendar className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-2xl font-semibold mb-3">No Date Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a date from the calendar to view available shifts.
          </p>
          <Button asChild>
            <Link href="/shifts">Back to Calendar</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const selectedDate = parseISOInNZT(dateParam);
  const selectedLocation = locationParam
    ? decodeURIComponent(locationParam)
    : undefined;

  const previousDate = subDays(selectedDate, 1);
  const nextDate = addDays(selectedDate, 1);
  const previousDateParam = formatInNZT(previousDate, "yyyy-MM-dd");
  const nextDateParam = formatInNZT(nextDate, "yyyy-MM-dd");

  const buildNavUrl = (dateStr: string) => {
    const navParams = new URLSearchParams();
    navParams.set("date", dateStr);
    if (selectedLocation) {
      navParams.set("location", selectedLocation);
    }
    return `/shifts/details?${navParams.toString()}`;
  };

  return (
    <PageContainer testid="shifts-details-page">
      {/* Navigation shell renders immediately */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={
              selectedLocation
                ? `/shifts?location=${encodeURIComponent(selectedLocation)}`
                : "/shifts"
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Calendar</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="sm" asChild data-testid="prev-day-button">
            <Link href={buildNavUrl(previousDateParam)}>
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{formatInNZT(previousDate, "EEE, MMM d")}</span>
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="next-day-button">
            <Link href={buildNavUrl(nextDateParam)}>
              <span className="hidden sm:inline">{formatInNZT(nextDate, "EEE, MMM d")}</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      <PageHeader
        title={`${formatInNZT(selectedDate, "EEEE, MMMM d, yyyy")}`}
        description={
          selectedLocation ? (
            <div className="">
              <div
                className="flex items-center gap-2"
                data-testid="restaurant-location-badge"
              >
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="font-semibold text-base text-primary">
                  {selectedLocation}
                </span>
              </div>
              {LOCATION_ADDRESSES[selectedLocation as unknown as Location] && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground pl-6">
                  <a
                    href={getLocationMapsUrl(selectedLocation as Location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="restaurant-address"
                    className="text-left hover:text-primary hover:underline"
                  >
                    {LOCATION_ADDRESSES[selectedLocation as Location]}
                  </a>
                </div>
              )}
            </div>
          ) : undefined
        }
        className="mb-8"
        data-testid="shifts-details-page-header"
      />

      {/* Profile completion banner streams in */}
      <Suspense fallback={null}>
        <ShiftsProfileCompletionBanner />
      </Suspense>

      {/* Shift cards stream in when data is ready */}
      <Suspense
        fallback={
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <div>
                  <Skeleton className="h-6 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Skeleton className="w-10 h-10 rounded-xl" />
                          <div className="flex-1">
                            <Skeleton className="h-6 w-40 mb-2" />
                            <Skeleton className="h-5 w-16" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Skeleton className="h-16 rounded-lg" />
                          <Skeleton className="h-16 rounded-lg" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        }
      >
        <ShiftDetailsContent
          dateParam={dateParam}
          selectedLocation={selectedLocation}
        />
      </Suspense>
    </PageContainer>
  );
}
