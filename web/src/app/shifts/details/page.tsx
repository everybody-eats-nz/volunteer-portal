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
import { getLocationAddresses, getGoogleMapsUrl } from "@/lib/locations";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { getBaseUrl } from "@/lib/utils";
import { ShareShiftButton } from "@/components/share-shift-button";

type SessionFilter = "day" | "evening" | undefined;

function parseSession(value: string | string[] | undefined): SessionFilter {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === "day" || v === "evening") return v;
  return undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const locationParam = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const sessionFilter = parseSession(params.session);

  if (!dateParam) {
    return buildPageMetadata({
      title: "Pick a day to volunteer",
      description:
        "Choose a date and location to see the volunteer shifts available at Everybody Eats.",
      path: "/shifts/details",
      noIndex: true,
    });
  }

  let selectedDate: Date;
  try {
    selectedDate = parseISOInNZT(dateParam);
  } catch {
    return buildPageMetadata({
      title: "Volunteer shifts",
      description: "Browse upcoming volunteer shifts at Everybody Eats.",
      path: "/shifts/details",
      noIndex: true,
    });
  }

  const decodedLocation = locationParam
    ? decodeURIComponent(locationParam)
    : undefined;
  const dayLabel = formatInNZT(selectedDate, "EEEE d MMMM yyyy");
  const sessionLabel =
    sessionFilter === "day"
      ? "Day shifts"
      : sessionFilter === "evening"
        ? "Evening shifts"
        : "Volunteer shifts";

  const title = `${sessionLabel}${
    decodedLocation ? ` · ${decodedLocation}` : ""
  } · ${dayLabel}`;

  const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
  const sessionDescription =
    sessionFilter === "day"
      ? "Day shifts run before 4pm."
      : sessionFilter === "evening"
        ? "Evening shifts run from 4pm onwards."
        : "See every shift on the day at a glance.";

  const description = `Volunteer with Everybody Eats on ${dayLabel}${
    decodedLocation ? ` at ${decodedLocation}` : ""
  }. ${sessionDescription} Sign up to help transform rescued food into community meals.`;

  const ogParams = new URLSearchParams({ date: dateParam });
  if (decodedLocation) ogParams.set("location", decodedLocation);
  if (sessionFilter) ogParams.set("session", sessionFilter);
  const ogImage = `${getBaseUrl()}/shifts/details/og?${ogParams.toString()}`;

  const canonicalParams = new URLSearchParams({ date: dateParam });
  if (decodedLocation) canonicalParams.set("location", decodedLocation);
  if (sessionFilter) canonicalParams.set("session", sessionFilter);

  return buildPageMetadata({
    title,
    description,
    path: `/shifts/details?${canonicalParams.toString()}`,
    ogImage,
    noIndex: isPast,
  });
}

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
  const sessionFilter = parseSession(params.session);

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

  // Resolve the address fresh so a newly created location shows immediately.
  const locationAddresses = await getLocationAddresses();
  const selectedLocationAddress = selectedLocation
    ? locationAddresses[selectedLocation]
    : undefined;
  const selectedLocationMapsUrl = selectedLocationAddress
    ? getGoogleMapsUrl(selectedLocationAddress)
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
    if (sessionFilter) {
      navParams.set("session", sessionFilter);
    }
    return `/shifts/details?${navParams.toString()}`;
  };

  const shareParams = new URLSearchParams({ date: dateParam });
  if (selectedLocation) shareParams.set("location", selectedLocation);
  if (sessionFilter) shareParams.set("session", sessionFilter);
  const shareUrl = `${getBaseUrl()}/shifts/details?${shareParams.toString()}`;
  const shareLabel =
    sessionFilter === "day"
      ? `Day shifts on ${formatInNZT(selectedDate, "EEEE d MMMM")}`
      : sessionFilter === "evening"
        ? `Evening shifts on ${formatInNZT(selectedDate, "EEEE d MMMM")}`
        : `Volunteer shifts on ${formatInNZT(selectedDate, "EEEE d MMMM")}`;

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
          <ShareShiftButton
            url={shareUrl}
            title={`${shareLabel}${selectedLocation ? ` at ${selectedLocation}` : ""} — Everybody Eats`}
            text={`Kia ora! Come volunteer on ${formatInNZT(
              selectedDate,
              "EEEE d MMMM"
            )}${selectedLocation ? ` at ${selectedLocation}` : ""}.`}
          />
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
              {selectedLocationAddress && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground pl-6">
                  <a
                    href={selectedLocationMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="restaurant-address"
                    className="text-left hover:text-primary hover:underline"
                  >
                    {selectedLocationAddress}
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

      {/* Shift cards stream in when data is ready.
          Key forces a clean unmount/remount on navigation between dates or
          locations — without it, rapid prev/next clicks can put React's
          reconciler into a state where it tries to re-parent a portal-using
          subtree (Radix Dialog/Drawer inside ShiftSignupButton) into one of
          its own descendants, throwing HierarchyRequestError during commit. */}
      <Suspense
        key={`${dateParam}-${selectedLocation ?? "all"}-${sessionFilter ?? "both"}`}
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
          session={sessionFilter}
        />
      </Suspense>
    </PageContainer>
  );
}
