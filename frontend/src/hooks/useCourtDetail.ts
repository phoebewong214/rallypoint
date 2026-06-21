import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courtActivityApi, type CreateAppointmentBody } from "../api/appointments";

export function useCourtDetail(slug: string | undefined) {
  return useQuery({
    queryKey: ["court", slug],
    queryFn: () => courtActivityApi.detail(slug as string),
    enabled: !!slug,
    staleTime: 15_000,
  });
}

/* All mutations refresh the open court detail + the courts list (busy badges). */
function useCourtMutation<TArgs>(fn: (a: TArgs) => Promise<unknown>, slug?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["court", slug] });
      qc.invalidateQueries({ queryKey: ["courts"] });
    },
  });
}

export function useCreateAppointment(slug: string) {
  return useCourtMutation((body: CreateAppointmentBody) => courtActivityApi.create(slug, body), slug);
}
export function useJoinAppointment(slug: string) {
  return useCourtMutation((id: number) => courtActivityApi.join(id), slug);
}
export function useLeaveAppointment(slug: string) {
  return useCourtMutation((id: number) => courtActivityApi.leave(id), slug);
}
export function useCancelAppointment(slug: string) {
  return useCourtMutation((id: number) => courtActivityApi.cancel(id), slug);
}
export function useCheckIn(slug: string) {
  return useCourtMutation((coords?: { lat: number; lng: number }) => courtActivityApi.checkIn(slug, coords), slug);
}
export function useCheckOut(slug: string) {
  return useCourtMutation(() => courtActivityApi.checkOut(slug), slug);
}
