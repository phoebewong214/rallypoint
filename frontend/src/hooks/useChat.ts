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

/* The viewer's unread total across live threads, keyed ['chatUnread'] — the
   key the SSE `chat` nudge (and the fallback poll sweep) invalidates — so the
   nav red dot lights up from any page within push latency. */
export function useChatUnread(enabled = true) {
  return useQuery({
    queryKey: ["chatUnread"],
    queryFn: chatApi.unreadTotal,
    enabled,
    staleTime: 15_000,
  });
}

/* Report the read position (highest message id rendered). The server only
   moves it forward, so racing reports are harmless. Success invalidates the
   two unread surfaces — nav dot total and per-card counts — so they clear
   right away instead of waiting for the next sweep. */
export function useMarkChatRead(inviteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lastReadId: number) => chatApi.markRead(inviteId, lastReadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chatUnread"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
