"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LocationOption } from "@/lib/locations";

const LOCATION_PREFERENCE_KEY = "admin-location-preference";

/**
 * Hook to persist and restore location filter preferences across admin pages
 * Saves the selected location to localStorage and auto-restores it on page load
 */
export function useLocationPreference(currentLocation?: LocationOption) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialMount = useRef(true);
  const hasRestoredRef = useRef(false);

  // Auto-restore location preference on mount if no location is in URL
  // This MUST run before the save effect
  useEffect(() => {
    const locationParam = searchParams.get("location");

    // Only auto-restore if there's no location in the URL and we haven't restored yet
    if (!locationParam && !hasRestoredRef.current) {
      const savedLocation = localStorage.getItem(LOCATION_PREFERENCE_KEY);

      if (savedLocation) {
        hasRestoredRef.current = true;
        // Build new URL with saved location
        const params = new URLSearchParams(searchParams.toString());
        params.set("location", savedLocation);
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, [searchParams, pathname, router]);

  // Save location preference when it changes (but not on initial mount)
  useEffect(() => {
    // Skip saving on the very first render to avoid overwriting with default value
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (currentLocation) {
      localStorage.setItem(LOCATION_PREFERENCE_KEY, currentLocation);
    }
  }, [currentLocation]);

  return {
    savedLocation: typeof window !== "undefined"
      ? localStorage.getItem(LOCATION_PREFERENCE_KEY)
      : null,
  };
}

/**
 * Hook for client components to get and set location preference
 * Use this for components that manage location state locally (not via URL)
 */
export function useLocationPreferenceState() {
  const getPreference = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LOCATION_PREFERENCE_KEY);
  };

  const setPreference = (location: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LOCATION_PREFERENCE_KEY, location);
  };

  return {
    getLocationPreference: getPreference,
    setLocationPreference: setPreference,
  };
}
