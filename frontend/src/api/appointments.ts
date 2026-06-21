import { api } from "./client";
import type { ApiCourt } from "./courts";

export interface AppointmentPlayer {
  initials: string;
  color: string | null;
  name: string;
}

export interface Appointment {
  id: number;
  courtSlug: string | null;
  courtName: string | null;
  sport: "Tennis" | "Pickleball";
  scheduledAt: string | null;
  maxPlayers: number;
  note: string | null;
  status: string;
  host: string | null;
  isHost: boolean;
  confirmedCount: number;
  waitlistCount: number;
  spotsLeft: number;
  players: AppointmentPlayer[];
  joined: boolean;
  waitlisted: boolean;
  queuePosition: number | null;
}

export interface CourtDetail extends ApiCourt {
  regularsCount: number;
  regulars: AppointmentPlayer[];
  hereNow: number;
  checkedIn: boolean;
  appointments: Appointment[];
}

export interface CreateAppointmentBody {
  sport: "Tennis" | "Pickleball";
  scheduledAt: string; // ISO
  maxPlayers: number;
  note?: string;
}

export const courtActivityApi = {
  detail: (slug: string) => api<{ court: CourtDetail }>(`/courts/${slug}`),
  create: (slug: string, body: CreateAppointmentBody) =>
    api<{ appointment: Appointment }>(`/courts/${slug}/appointments`, { method: "POST", body }),
  join: (id: number) =>
    api<{ appointment: Appointment }>(`/appointments/${id}/join`, { method: "POST" }),
  leave: (id: number) =>
    api<{ appointment: Appointment }>(`/appointments/${id}/leave`, { method: "POST" }),
  cancel: (id: number) =>
    api<{ appointment: Appointment }>(`/appointments/${id}`, { method: "DELETE" }),
  checkIn: (slug: string, coords?: { lat: number; lng: number }) =>
    api<{ ok: boolean; checkedIn: boolean }>(`/courts/${slug}/checkin`, { method: "POST", body: coords ?? {} }),
  checkOut: (slug: string) =>
    api<{ ok: boolean; checkedIn: boolean }>(`/courts/${slug}/checkin`, { method: "DELETE" }),
};
