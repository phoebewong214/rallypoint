import { api } from "./client";

export interface ApiSession {
  id: number;
  bucket: "upcoming" | "requests" | "past";
  status: "confirmed" | "pending" | "requested" | "completed" | "cancelled";
  opp: string | null;
  oppId: number | null;
  oppHandle: string | null;
  oppNtrp: string | null;
  sentByMe: boolean;
  sport: "Tennis" | "Pickleball";
  court: string | null;
  courtMiles: string | null;
  scheduledAt: string | null;
  month: string | null;
  day: string | null;
  weekday: string | null;
  time: string | null;
  note: string | null;
  next?: boolean;
}

export interface CreateSessionBody {
  guestId: number;
  sport: "Tennis" | "Pickleball";
  scheduledAt: string; // ISO
  note?: string;
  court?: string; // court slug, when the request started from a court page
}

export interface RescheduleBody {
  scheduledAt: string; // ISO
  note?: string;
}

export const sessionsApi = {
  list: () => api<{ sessions: ApiSession[] }>("/sessions"),
  create: (body: CreateSessionBody) =>
    api<{ session: ApiSession }>("/sessions", { method: "POST", body }),
  accept: (id: number) =>
    api<{ session: ApiSession }>(`/sessions/${id}/accept`, { method: "POST" }),
  decline: (id: number) =>
    api<{ session: ApiSession }>(`/sessions/${id}/decline`, { method: "POST" }),
  cancel: (id: number) =>
    api<{ session: ApiSession }>(`/sessions/${id}/cancel`, { method: "POST" }),
  reschedule: (id: number, body: RescheduleBody) =>
    api<{ session: ApiSession }>(`/sessions/${id}/reschedule`, { method: "POST", body }),
};
