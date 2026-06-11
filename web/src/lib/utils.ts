import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Configuration constants
export const GUARDIAN_REQUIRED_AGE = 14;
export const MAX_NOTE_LENGTH = 500;

// Age calculation utility
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }
  return age;
}

// Get the base URL for the application.
// Used server-side to build absolute links (verification/reset emails, OAuth
// callbacks, SEO canonical URLs), so it must reflect the public domain.
export function getBaseUrl(): string {
  // Canonical app URL — set in every self-hosted environment (Coolify, local).
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }

  // Back-compat with Vercel deployments
  if (process.env.VERCEL_ENV === "preview") {
    return "https://demo.everybody-eats.vercel.app";
  }
  if (process.env.VERCEL_ENV === "production") {
    return "https://volunteers.everybodyeats.nz";
  }
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}
