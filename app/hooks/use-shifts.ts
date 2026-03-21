import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Shift } from "@/lib/dummy-data";

type ShiftsResponse = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
};

type UseShiftsReturn = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useShifts(): UseShiftsReturn {
  const [data, setData] = useState<ShiftsResponse>({
    myShifts: [],
    available: [],
    past: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      setError(null);
      const result = await api<ShiftsResponse>("/api/mobile/shifts");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchShifts();
  }, [fetchShifts]);

  return {
    ...data,
    isLoading,
    error,
    refresh,
  };
}
