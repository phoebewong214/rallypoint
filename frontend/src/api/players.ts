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

export type ReportReason =
  | "harassment"
  | "no_show"
  | "fake_profile"
  | "inappropriate"
  | "safety"
  | "other";

/** Reason options for the report modal — value matches the backend enum. */
export const REPORT_REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment or abusive messages" },
  { value: "no_show", label: "No-show / didn't honor the game" },
  { value: "fake_profile", label: "Fake or impersonating profile" },
  { value: "inappropriate", label: "Inappropriate profile content" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

export const playersApi = {
  list: (filters: PlayerFilters = {}) =>
    api<PlayersResponse>("/players" + toQS(filters)),

  report: (pid: number | string, body: { reason: ReportReason; details?: string }) =>
    api<{ ok: true }>(`/players/${pid}/report`, { method: "POST", body }),
};
