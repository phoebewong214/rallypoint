import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesApi, type CreateInviteBody, type ProposeTimeBody } from "../api/invites";

const KEY = ["invites"];
const SESSIONS_KEY = ["sessions"];

export function useInvites(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: invitesApi.list,
    staleTime: 30_000,
    enabled,
  });
}

/* Invite transitions can both change the invite list AND materialize a real
   session (accept-time) or retire one — so every mutation refreshes both feeds
   that My Games / Find Partner read from. */
function useInviteMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useCreateInvite() {
  return useInviteMutation((body: CreateInviteBody) => invitesApi.create(body));
}

export function useConfirmOpponent() {
  return useInviteMutation((id: number) => invitesApi.confirmOpponent(id));
}

export function useProposeTime() {
  return useInviteMutation(({ id, ...body }: { id: number } & ProposeTimeBody) =>
    invitesApi.proposeTime(id, body),
  );
}

export function useAcceptTime() {
  return useInviteMutation((id: number) => invitesApi.acceptTime(id));
}

export function useDeclineInvite() {
  return useInviteMutation(({ id, reason }: { id: number; reason?: string }) =>
    invitesApi.decline(id, reason),
  );
}

export function useCancelInvite() {
  return useInviteMutation((id: number) => invitesApi.cancel(id));
}
