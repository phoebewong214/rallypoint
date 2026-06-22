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
  courts?: string[]; // court slugs — only players whose home court is one of these
  timeBands?: string[]; // MORN/AFT/EVE — players available in any of these bands
}

function toQS(filters: PlayerFilters): string {
  const params: string[] = [];
  if (filters.sport) params.push(`sport=${encodeURIComponent(filters.sport)}`);
  if (filters.ntrpMin !== undefined) params.push(`ntrpMin=${filters.ntrpMin}`);
  if (filters.ntrpMax !== undefined) params.push(`ntrpMax=${filters.ntrpMax}`);
  if (filters.courts && filters.courts.length) params.push(`courts=${filters.courts.map(encodeURIComponent).join(",")}`);
  if (filters.timeBands && filters.timeBands.length) params.push(`timeBands=${filters.timeBands.join(",")}`);
  return params.length ? "?" + params.join("&") : "";
}

export const playersApi = {
  list: (filters: PlayerFilters = {}) =>
    api<PlayersResponse>("/players" + toQS(filters)),
};
