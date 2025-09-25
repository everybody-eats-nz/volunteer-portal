import { Suspense } from "react";
import RegisterClient from "./register-client";
import { prisma } from "@/lib/prisma";

async function getLocationOptions() {
  // Get all unique locations from shifts that are not null
  const shifts = await prisma.shift.findMany({
    select: {
      location: true,
    },
    where: {
      location: {
        not: null,
      },
    },
  });

  // Extract unique locations, clean all whitespace, and sort them
  const uniqueLocations = [
    ...new Set(
      shifts
        .map((shift: { location: string | null }) => shift.location)
        .filter(
          (location: string | null): location is string => location !== null
        )
        .map((location: string) => location.replace(/\s+/g, " ").trim()) // Clean all whitespace
        .filter((location: string) => location.length > 0) // Remove empty strings
    ),
  ].sort();

  // Transform to the format expected by the frontend
  return uniqueLocations.map((location) => ({
    value: location,
    label: location,
  }));
}

async function getShiftTypes() {
  const shiftTypes = await prisma.shiftType.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return shiftTypes;
}

/**
 * Multi-step volunteer registration page
 * Collects comprehensive user profile information during signup
 */
export default async function RegisterPage() {
  const [locationOptions, shiftTypes] = await Promise.all([
    getLocationOptions(),
    getShiftTypes(),
  ]);

  return (
    <Suspense fallback={<div>Loading registration form...</div>}>
      <RegisterClient 
        locationOptions={locationOptions}
        shiftTypes={shiftTypes}
      />
    </Suspense>
  );
}