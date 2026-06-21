import { api } from "./client";

export interface SavedPlayer {
  id: number;
  name: string;
  initials: string;
  color: string | null;
  fg: string | null;
  location: string | null;
  primarySport: string | null;
  sports: string[];
}

export const savedPlayersApi = {
  list: () => api<{ players: SavedPlayer[]; count: number }>("/players/saved"),
  save: (id: number) => api<{ id: number; saved: boolean }>(`/players/${id}/save`, { method: "POST" }),
  unsave: (id: number) => api<{ id: number; saved: boolean }>(`/players/${id}/save`, { method: "DELETE" }),
};
