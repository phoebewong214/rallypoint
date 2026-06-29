import { api } from "./client";
import type { User } from "../types";

/** A user record as returned by the admin endpoints: the full profile plus the
 *  email/verification/admin flags and a precise ISO join timestamp. */
export interface AdminUser extends User {
  email?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
  createdAt?: string | null;
}

export interface AdminStats {
  users: {
    total: number;
    real: number;
    demo: number;
    verified: number;
    admins: number;
    new7d: number;
    new30d: number;
  };
  invites: number;
  appointments: number;
  courts: number;
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
  bio?: string;
  location?: string;
  lat?: number;
  lng?: number;
  primarySport?: "Tennis" | "Pickleball";
  sportProfiles?: { sport: "Tennis" | "Pickleball"; ntrp: string; homeCourt?: string; availabilitySummary?: string }[];
}

export const adminApi = {
  stats: () => api<AdminStats>("/admin/stats"),

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
};
