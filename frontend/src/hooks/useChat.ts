import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../api/invites";

/* Per-game chat thread, keyed ['chat', inviteId] — the key the SSE `chat`
   nudge invalidates (see useInviteStream), so an open panel refetches within
   the push channel's latency and everything else stays untouched. */
export function useChatMessages(inviteId: number, enabled = true) {
  return useQuery({
    queryKey: ["chat", inviteId],
    queryFn: () => chatApi.list(inviteId),
    enabled,
    staleTime: 5_000,
  });
}

/* No optimistic update by design: the send is fast, and refetching after the
   server confirms keeps ordering/ids exactly as persisted. */
export function useSendChatMessage(inviteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => chatApi.send(inviteId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", inviteId] });
    },
  });
}
