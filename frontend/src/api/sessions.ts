import { api } from "./client";

export interface ApiSession {
  id: number;
  bucket: "upcoming" | "requests" | "past";
  status: "confirmed" | "pending" | "requested" | "completed" | "cancelled";
  opp: string | null;
  oppHandle: string | null;
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
  result: "W" | "L" | null;
  score: string | null;
  next?: boolean;
}

export interface CreateSessionBody {
  guestId: number;
  sport: "Tennis" | "Pickleball";
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
};
