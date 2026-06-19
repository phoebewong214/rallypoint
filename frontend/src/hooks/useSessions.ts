import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "../api/sessions";

const KEY = ["sessions"];

export function useSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn: sessionsApi.list,
    staleTime: 30_000,
  });
}

export function useAcceptSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sessionsApi.accept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeclineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sessionsApi.decline(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sessionsApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRescheduleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledAt, note }: { id: number; scheduledAt: string; note?: string }) =>
      sessionsApi.reschedule(id, { scheduledAt, note }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

