import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courtsApi, type CourtFilters, type CourtsResponse } from "../api/courts";

export function useCourts(filters: CourtFilters = {}) {
  return useQuery({
    queryKey: ["courts", filters],
    queryFn: () => courtsApi.list(filters),
    staleTime: 60_000,
  });
}

/* Toggle a court favorite with an optimistic cache update so the bookmark
   flips instantly, rolling back if the request fails. */
export function useToggleCourtFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, fav }: { slug: string; fav: boolean }) =>
      fav ? courtsApi.favorite(slug) : courtsApi.unfavorite(slug),
    onMutate: async ({ slug, fav }) => {
      await qc.cancelQueries({ queryKey: ["courts"] });
      const prev = qc.getQueriesData<CourtsResponse>({ queryKey: ["courts"] });
      qc.setQueriesData<CourtsResponse>({ queryKey: ["courts"] }, (old) =>
        old
          ? { ...old, courts: old.courts.map((c) => (c.id === slug ? { ...c, fav } : c)) }
          : old,
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["courts"] }),
  });
}
