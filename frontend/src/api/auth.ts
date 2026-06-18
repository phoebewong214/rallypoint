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
}

export const authApi = {
  login: (input: LoginInput) =>
    api<AuthResponse>("/auth/login", { method: "POST", body: input }),

  signup: (input: SignupBody) =>
    api<AuthResponse>("/auth/signup", { method: "POST", body: input }),

  me: () => api<{ user: User }>("/auth/me"),

  updateMe: (body: UpdateProfileBody) =>
    api<{ user: User }>("/auth/me", { method: "PATCH", body }),
};
