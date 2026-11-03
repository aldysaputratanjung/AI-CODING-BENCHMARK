import { useQuery } from "@tanstack/react-query";
import type { SessionUser } from "@shared/schemas";
import { api } from "../services/api";

export function useAuth() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: () => api.get<{ user: SessionUser | null }>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}
