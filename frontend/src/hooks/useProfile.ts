import { useCallback } from "react";
import { profileService } from "../services/profileService";
import { useDetailCache } from "./useDetailCache";

const CACHE_KEY = "profile:me";

export const useProfile = () => {
  const fetcher = useCallback(async (_signal: AbortSignal) => {
    return await profileService.fetchProfile();
  }, []);

  const { data: employee, loading, refreshing, refresh } = useDetailCache<any>({
    cacheKey: CACHE_KEY,
    socketModule: "employee",
    fetcher,
  });

  return {
    employee,
    loading,
    refreshing,
    refresh,
  };
};
