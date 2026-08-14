import { api } from "./client";
import type { ApiSession } from "./sessions";

/* Two-phase invites. The backend serializes an invite into a SESSION-COMPATIBLE
   shape (same bucket/status/date fields) so My Games can render invites and
   legacy sessions in one feed — `kind: "invite"` tells them apart, and the
   extra fields below drive the negotiation UI. */
export interface ApiInvite extends Omit<ApiSession, "next"> {
  kind: "invite";
  phase:
    | "awaiting_opponent"
    | "settling_time"
    | "confirmed"
    | "declined"
    | "cancelled";
  yourTurn: boolean;
  // the proposed time on the table; when isWindow, [scheduledAt, proposalEnd]
  proposalEnd: string | null;
  isWindow: boolean;
  declineReason: string | null;
}

export interface CreateInviteBody {
  inviteeId: number;
  sport: "Tennis" | "Pickleball";
  startAt: string; // ISO — the proposed time (window start when endAt is set)
  endAt?: string | null; // ISO — set ⇒ an offered window [startAt, endAt]
  note?: string;
  court?: string; // court slug, when the invite started from a court page
}

export interface ProposeTimeBody {
  startAt: string; // ISO
  endAt?: string | null; // ISO — counter with a window (usually a specific time)
}

/* Per-game chat. Threads are keyed by INVITE id (stable for the game's whole
   life, even when the materialized session is cancelled); confirmed session
   rows carry `inviteId` so the card can open its thread. `mine` is
   viewer-relative, like `sentByMe` on sessions. */
export interface ApiChatMessage {
  id: number;
  inviteId: number;
  senderId: number;
  senderName: string | null;
  mine: boolean;
  body: string;
  createdAt: string; // ISO, UTC
}

export const chatApi = {
  list: (inviteId: number, after?: number) =>
    api<{ messages: ApiChatMessage[] }>(
      `/invites/${inviteId}/messages${after != null ? `?after=${after}` : ""}`,
    ),
  send: (inviteId: number, body: string) =>
    api<{ message: ApiChatMessage }>(`/invites/${inviteId}/messages`, {
      method: "POST",
      body: { body },
    }),
  // Advance the server-side read position (forward-only there); lastReadId is
  // the highest message id the client has rendered.
  markRead: (inviteId: number, lastReadId: number) =>
    api<{ unread: number }>(`/invites/${inviteId}/messages/read`, {
      method: "POST",
      body: { lastReadId },
    }),
  // Viewer's unread total across live threads — feeds the nav red dot.
  unreadTotal: () => api<{ total: number }>("/chat/unread-total"),
};

export const invitesApi = {
  list: () => api<{ invites: ApiInvite[] }>("/invites"),
  create: (body: CreateInviteBody) =>
    api<{ invite: ApiInvite }>("/invites", { method: "POST", body }),
  confirmOpponent: (id: number) =>
    api<{ invite: ApiInvite }>(`/invites/${id}/confirm-opponent`, { method: "POST" }),
  proposeTime: (id: number, body: ProposeTimeBody) =>
    api<{ invite: ApiInvite }>(`/invites/${id}/propose-time`, { method: "POST", body }),
  acceptTime: (id: number) =>
    api<{ invite: ApiInvite; session: ApiSession }>(`/invites/${id}/accept-time`, { method: "POST" }),
  decline: (id: number, reason?: string) =>
    api<{ invite: ApiInvite }>(`/invites/${id}/decline`, { method: "POST", body: { reason } }),
  cancel: (id: number) =>
    api<{ invite: ApiInvite }>(`/invites/${id}/cancel`, { method: "POST" }),
};
