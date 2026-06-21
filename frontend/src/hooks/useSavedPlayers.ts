import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedPlayersApi } from "../api/savedPlayers";
import type { PlayersResponse } from "../api/players";

export function useSavedPlayers() {
  return useQuery({
    queryKey: ["savedPlayers"],
    queryFn: savedPlayersApi.list,
    staleTime: 30_000,
  });
}

/* Toggle a saved player with an optimistic update to the players list so the
   bookmark flips instantly; rolls back on error. */
export function useToggleSavedPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: { id: number; saved: boolean }) =>
      saved ? savedPlayersApi.save(id) : savedPlayersApi.unsave(id),
    onMutate: async ({ id, saved }) => {
      await qc.cancelQueries({ queryKey: ["players"] });
      const prev = qc.getQueriesData<PlayersResponse>({ queryKey: ["players"] });
      qc.setQueriesData<PlayersResponse>({ queryKey: ["players"] }, (old) =>
        old ? { ...old, players: old.players.map((p) => (p.id === id ? { ...p, saved } : p)) } : old,
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["savedPlayers"] });
    },
  });
}
