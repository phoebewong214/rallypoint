import { api } from "./client";

export interface ApiCourt {
  id: string;
  name: string;
  addr: string;
  lat: number;
  lng: number;
  primary: "tennis" | "pickleball";
  sports: ("Tennis" | "Pickleball")[];
  courtCount: number;
  surface: string;
  lights: boolean;
  distance: number | null; // straight-line miles from the viewer, null if unknown
  fav: boolean;
}

export interface CourtsResponse {
  courts: ApiCourt[];
  count: number;
}

export interface CourtFilters {
  sport?: "Tennis" | "Pickleball";
  q?: string;
}

function toQS(filters: CourtFilters): string {
  const params: string[] = [];
  if (filters.sport) params.push(`sport=${encodeURIComponent(filters.sport)}`);
  if (filters.q) params.push(`q=${encodeURIComponent(filters.q)}`);
  return params.length ? "?" + params.join("&") : "";
}

export const courtsApi = {
  list: (filters: CourtFilters = {}) =>
    api<CourtsResponse>("/courts" + toQS(filters)),
  get: (slug: string) =>
    api<{ court: ApiCourt }>(`/courts/${slug}`),
  favorite: (slug: string) =>
    api<{ id: string; fav: boolean }>(`/courts/${slug}/favorite`, { method: "POST" }),
  unfavorite: (slug: string) =>
    api<{ id: string; fav: boolean }>(`/courts/${slug}/favorite`, { method: "DELETE" }),
};
