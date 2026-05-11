import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { api } from "@/lib/api";
import type { Achievement, ProfileStats, UserProfile } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";
import { useAchievementCelebrationStore } from "./use-achievement-celebration";

type ProfileResponse = {
  profile: {
    id: string;
    name: string | null;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    pronouns: string | null;
    image: string | null;
    role: string;
    volunteerGrade: "GREEN" | "YELLOW" | "PINK";
    memberSince: string;
    dateOfBirth: string | null;
    emergencyContactName: string | null;
    emergencyContactRelationship: string | null;
    emergencyContactPhone: string | null;
    medicalConditions: string | null;
    notificationPreference: "EMAIL" | "SMS" | "BOTH" | "NONE";
    receiveShortageNotifications: boolean;
    excludedShortageNotificationTypes: string[];
    emailNewsletterSubscription: boolean;
    newsletterLists: string[];
    defaultLocation: string | null;
    friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
    allowFriendRequests: boolean;
    allowFriendSuggestions: boolean;
  };
  availableLocations: string[];
  stats: ProfileStats;
  achievements: Achievement[];
  totalPoints: number;
  totalVolunteers: number;
};

type UseProfileReturn = {
  profile: UserProfile | null;
  availableLocations: string[];
  stats: ProfileStats | null;
  achievements: Achievement[];
  totalPoints: number;
  totalVolunteers: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useProfile(): UseProfileReturn {
  const query = useQuery({
    queryKey: queryKeys.profile.me,
    queryFn: () => api<ProfileResponse>("/api/mobile/profile"),
  });

  // The mobile profile route runs checkAndUnlockAchievements server-side, so
  // any new unlock arrives in this payload — queue it for celebration each
  // time fresh data lands. Keyed on dataUpdatedAt so a refetch with no new
  // achievements still passes the dedup inside `queueIfNew`.
  const achievements = query.data?.achievements;
  const dataUpdatedAt = query.dataUpdatedAt;
  useEffect(() => {
    if (!achievements) return;
    useAchievementCelebrationStore.getState().queueIfNew(achievements);
  }, [achievements, dataUpdatedAt]);

  const data = query.data;
  const profile: UserProfile | null = data
    ? {
        id: data.profile.id,
        name: data.profile.name ?? "",
        email: data.profile.email,
        role: data.profile.role as "VOLUNTEER" | "ADMIN",
        image: data.profile.image,
        profileComplete: true,
        firstName: data.profile.firstName ?? "",
        lastName: data.profile.lastName ?? "",
        phone: data.profile.phone ?? "",
        pronouns: data.profile.pronouns ?? "",
        volunteerGrade: data.profile.volunteerGrade,
        emergencyContactName: data.profile.emergencyContactName ?? "",
        emergencyContactRelationship: data.profile.emergencyContactRelationship ?? "",
        emergencyContactPhone: data.profile.emergencyContactPhone ?? "",
        medicalConditions: data.profile.medicalConditions ?? "",
        notificationPreference: data.profile.notificationPreference,
        receiveShortageNotifications: data.profile.receiveShortageNotifications,
        excludedShortageNotificationTypes: data.profile.excludedShortageNotificationTypes,
        emailNewsletterSubscription: data.profile.emailNewsletterSubscription,
        newsletterLists: data.profile.newsletterLists,
        defaultLocation: data.profile.defaultLocation,
        friendVisibility: data.profile.friendVisibility,
        allowFriendRequests: data.profile.allowFriendRequests,
        allowFriendSuggestions: data.profile.allowFriendSuggestions,
        totalShifts: data.stats.shiftsCompleted,
        memberSince: data.profile.memberSince,
      }
    : null;

  return {
    profile,
    availableLocations: data?.availableLocations ?? [],
    stats: data?.stats ?? null,
    achievements: data?.achievements ?? [],
    totalPoints: data?.totalPoints ?? 0,
    totalVolunteers: data?.totalVolunteers ?? 0,
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load profile"
      : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}
