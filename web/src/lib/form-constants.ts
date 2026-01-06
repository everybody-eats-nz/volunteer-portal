/**
 * Shared form constants used across the application
 * These are extracted from components to allow sharing between client and server components
 */

export const daysOfWeek = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export const pronounOptions = [
  { value: "none", label: "Prefer not to say" },
  { value: "she/her", label: "She/Her" },
  { value: "he/him", label: "He/Him" },
  { value: "they/them", label: "They/Them" },
  { value: "other", label: "Other" },
];

export const notificationOptions = [
  { value: "EMAIL", label: "Email only" },
  { value: "SMS", label: "Text message only" },
  { value: "BOTH", label: "Both email and text" },
  { value: "NONE", label: "No notifications" },
];

export const hearAboutUsOptions = [
  { value: "not_specified", label: "Select an option" },
  { value: "social_media", label: "Social Media" },
  { value: "friend_family", label: "Friend or Family" },
  { value: "website", label: "Website" },
  { value: "search_engine", label: "Search Engine" },
  { value: "community_event", label: "Community Event" },
  { value: "volunteer_center", label: "Volunteer Center" },
  { value: "other", label: "Other" },
];
