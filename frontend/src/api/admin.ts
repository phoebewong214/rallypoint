import { api } from "./client";
import type { User } from "../types";

/** A user record as returned by the admin endpoints: the full profile plus the
 *  email/verification/admin flags and a precise ISO join timestamp. */
export interface AdminUser extends User {
  email?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  isActive?: boolean;
  createdAt?: string | null;
}

export interface AdminStats {
  users: {
    total: number;
    real: number;
    demo: number;
    verified: number;
    admins: number;
    suspended: number;
    new7d: number;
    new30d: number;
  };
  openReports: number;
  openTickets: number;
  invites: number;
  appointments: number;
  courts: number;
}

/** Dashboard-home activity feed. */
export interface AdminOverview {
  recentSignups: { id: number; name: string; handle: string; email?: string; createdAt: string | null }[];
  recentInvites: {
    id: number; inviter: string | null; invitee: string | null;
    sport: string; phase: string; createdAt: string | null;
  }[];
  signupSeries: { date: string; count: number }[];
}

export type ReportReason =
  | "harassment"
  | "no_show"
  | "fake_profile"
  | "inappropriate"
  | "safety"
  | "other";

export type ReportStatus = "open" | "reviewed" | "dismissed";

/** A trust & safety report as returned by the admin queue. */
export interface AdminReport {
  id: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  reporter: { id: number; name: string; handle: string; email?: string } | null;
  reported: { id: number; name: string; handle: string; email?: string } | null;
  reportedIsActive: boolean | null;
  resolvedBy: { id: number; name: string; handle: string } | null;
}

export interface AdminReportList {
  reports: AdminReport[];
  openCount: number;
}

export type TicketStatus = "open" | "closed";

/** A persisted "talk to a human" escalation, as shown on the support desk. */
export interface SupportTicket {
  id: number;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  status: TicketStatus;
  createdAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  user: { id: number; name: string; handle: string; email?: string } | null;
  resolvedBy: { id: number; name: string } | null;
}

export interface SupportTicketList {
  tickets: SupportTicket[];
  openCount: number;
}

/** A court as managed on the admin Courts tab (keyed by numeric id). */
export interface AdminCourt {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  primarySport: "tennis" | "pickleball" | null;
  sports: ("Tennis" | "Pickleball")[];
  courtCount: number;
  surface: string | null;
  lights: boolean;
  isActive: boolean;
}

export interface AdminCourtPatch {
  name?: string;
  slug?: string;
  address?: string;
  lat?: number;
  lng?: number;
  primarySport?: "tennis" | "pickleball";
  sports?: ("Tennis" | "Pickleball")[];
  courtCount?: number;
  surface?: string;
  lights?: boolean;
  isActive?: boolean;
}

export interface AdminUserList {
  users: AdminUser[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

/** Fields an admin can edit on a user's behalf. All optional; only sent ones
 *  are applied. sportProfiles, when sent, is the complete desired set. */
export interface AdminUserPatch {
  name?: string;
  email?: string;
  handle?: string;
  emailVerified?: boolean;
  isActive?: boolean;
  bio?: string;
  location?: string;
  lat?: number;
  lng?: number;
  primarySport?: "Tennis" | "Pickleball";
  sportProfiles?: { sport: "Tennis" | "Pickleball"; ntrp: string; homeCourt?: string; availabilitySummary?: string }[];
}

export const adminApi = {
  stats: () => api<AdminStats>("/admin/stats"),

  overview: () => api<AdminOverview>("/admin/overview"),

  listUsers: (params: { q?: string; page?: number; perPage?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.perPage) qs.set("perPage", String(params.perPage));
    const suffix = qs.toString() ? `?${qs}` : "";
    return api<AdminUserList>(`/admin/users${suffix}`);
  },

  getUser: (id: string | number) => api<{ user: AdminUser }>(`/admin/users/${id}`),

  updateUser: (id: string | number, patch: AdminUserPatch) =>
    api<{ user: AdminUser }>(`/admin/users/${id}`, { method: "PATCH", body: patch }),

  listReports: (status: ReportStatus | "all" = "open") =>
    api<AdminReportList>(`/admin/reports?status=${status}`),

  reviewReport: (
    id: string | number,
    body: { status: "reviewed" | "dismissed"; note?: string; suspend?: boolean },
  ) => api<{ report: AdminReport }>(`/admin/reports/${id}`, { method: "PATCH", body }),

  listSupport: (status: TicketStatus | "all" = "open") =>
    api<SupportTicketList>(`/admin/support?status=${status}`),

  updateTicket: (id: string | number, body: { status: TicketStatus; note?: string }) =>
    api<{ ticket: SupportTicket }>(`/admin/support/${id}`, { method: "PATCH", body }),

  listCourts: () => api<{ courts: AdminCourt[] }>("/admin/courts"),

  createCourt: (body: AdminCourtPatch) =>
    api<{ court: AdminCourt }>("/admin/courts", { method: "POST", body }),

  updateCourt: (id: string | number, body: AdminCourtPatch) =>
    api<{ court: AdminCourt }>(`/admin/courts/${id}`, { method: "PATCH", body }),

  deleteCourt: (id: string | number) =>
    api<{ ok: true }>(`/admin/courts/${id}`, { method: "DELETE" }),
};
