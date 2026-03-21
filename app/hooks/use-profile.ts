import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Achievement, ProfileStats, UserProfile } from "@/lib/dummy-data";

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
  };
  stats: ProfileStats;
  achievements: Achievement[];
  totalPoints: number;
};

type UseProfileReturn = {
  profile: UserProfile | null;
  stats: ProfileStats | null;
  achievements: Achievement[];
  totalPoints: number;
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
        emergencyContactName: "",
        emergencyContactRelationship: "",
        emergencyContactPhone: "",
        totalShifts: data.stats.shiftsCompleted,
        memberSince: data.profile.memberSince,
      }
    : null;

  return {
    profile,
    stats: data?.stats ?? null,
    achievements: data?.achievements ?? [],
    totalPoints: data?.totalPoints ?? 0,
    isLoading,
    error,
    refresh,
  };
}
