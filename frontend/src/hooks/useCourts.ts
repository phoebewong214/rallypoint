import { useQuery } from "@tanstack/react-query";
import { courtsApi, type CourtFilters } from "../api/courts";

export function useCourts(filters: CourtFilters = {}) {
  return useQuery({
    queryKey: ["courts", filters],
    queryFn: () => courtsApi.list(filters),
    staleTime: 60_000,
  });
}
