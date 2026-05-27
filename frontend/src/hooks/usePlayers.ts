import { useQuery } from "@tanstack/react-query";
import { playersApi, type PlayerFilters } from "../api/players";

export function usePlayers(filters: PlayerFilters) {
  return useQuery({
    queryKey: ["players", filters],
    queryFn: () => playersApi.list(filters),
    staleTime: 30_000,
  });
}
