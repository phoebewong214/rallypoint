import { api } from "./client";
import type { User } from "../types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupBody extends LoginInput {
  name: string;
  sport: "Tennis" | "Pickleball";
  ntrp: string;
  location?: string;
  lat?: number;
  lng?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UpdateProfileBody {
  name?: string;
  bio?: string;
  location?: string;
  primarySport?: "Tennis" | "Pickleball";
  sportProfiles?: { sport: "Tennis" | "Pickleball"; ntrp: string; homeCourt?: string; availabilitySummary?: string }[];
}

export const authApi = {
  login: (input: LoginInput) =>
    api<AuthResponse>("/auth/login", { method: "POST", body: input }),

  signup: (input: SignupBody) =>
    api<AuthResponse>("/auth/signup", { method: "POST", body: input }),

  me: () => api<{ user: User }>("/auth/me"),

  updateMe: (body: UpdateProfileBody) =>
    api<{ user: User }>("/auth/me", { method: "PATCH", body }),

  // Clear the auth cookies on this device.
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // Revoke every outstanding token for the current user ("sign out everywhere").
  logoutAll: () => api<{ ok: boolean }>("/auth/logout-all", { method: "POST" }),

  // Request a password-reset email. Always resolves (no account enumeration).
  forgotPassword: (email: string) =>
    api<{ ok: boolean }>("/auth/forgot-password", { method: "POST", body: { email } }),

  // Set a new password using the token from the reset email.
  resetPassword: (token: string, password: string) =>
    api<{ ok: boolean }>("/auth/reset-password", { method: "POST", body: { token, password } }),

  // Confirm an email address from the verification link.
  verifyEmail: (token: string) =>
    api<{ ok: boolean; user: User }>("/auth/verify-email", { method: "POST", body: { token } }),

  // Re-send the verification email to the logged-in user.
  resendVerification: () =>
    api<{ ok: boolean; alreadyVerified: boolean }>("/auth/resend-verification", { method: "POST" }),
};
