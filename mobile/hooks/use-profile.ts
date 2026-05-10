import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Achievement, ProfileStats, UserProfile } from "@/lib/dummy-data";
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
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const result = await api<ProfileResponse>("/api/mobile/profile");
      setData(result);
      // The mobile profile route runs checkAndUnlockAchievements server-side,
      // so any new unlock shows up in this payload — queue it for celebration.
      useAchievementCelebrationStore
        .getState()
        .queueIfNew(result.achievements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  // Map API response to the shapes the screens expect
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
    isLoading,
    error,
    refresh,
  };
}
