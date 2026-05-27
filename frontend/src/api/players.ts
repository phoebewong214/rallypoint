import { api } from "./client";
import type { Player, Sport } from "../types";

export interface PlayersResponse {
  players: Player[];
  count: number;
}

export interface PlayerFilters {
  sport?: Sport;
  ntrpMin?: number;
  ntrpMax?: number;
}

function toQS(filters: PlayerFilters): string {
  const params: string[] = [];
  if (filters.sport) params.push(`sport=${encodeURIComponent(filters.sport)}`);
  if (filters.ntrpMin !== undefined) params.push(`ntrpMin=${filters.ntrpMin}`);
  if (filters.ntrpMax !== undefined) params.push(`ntrpMax=${filters.ntrpMax}`);
  return params.length ? "?" + params.join("&") : "";
}

export const playersApi = {
  list: (filters: PlayerFilters = {}) =>
    api<PlayersResponse>("/players" + toQS(filters)),
};
