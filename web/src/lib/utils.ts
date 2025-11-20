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

// Get the base URL for the application
// For demo environment, use the stable demo URL instead of commit-specific URLs
export function getBaseUrl(): string {
  // Check if we're in the demo environment
  if (process.env.VERCEL_ENV === "preview") {
    return "https://demo.everybody-eats.vercel.app";
  }

  if (process.env.VERCEL_ENV === "production") {
    return "https://volunteer.everybodyeats.nz";
  }

  // For other Vercel deployments or local development
  const vercelUrl = process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000";
}
