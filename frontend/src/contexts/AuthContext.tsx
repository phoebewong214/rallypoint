/* ============================================================
   AuthContext — single source of truth for the logged-in user.
   The JWT lives in an httpOnly cookie the browser sends automatically, so JS
   never holds it. We cache only the (non-secret) user object for instant first
   paint, then validate the session against /api/auth/me on mount; if the cookie
   is missing/stale we silently log out.
   ============================================================ */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "../types";
import { authApi } from "../api/auth";

const USER_STORAGE_KEY = "rallypoint.user";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupInput) => Promise<User>;
  logout: () => void;
  logoutEverywhere: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<User>;
}

export interface ProfilePatch {
  name?: string;
  bio?: string;
  location?: string;
  primarySport?: "Tennis" | "Pickleball";
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  sport: "Tennis" | "Pickleball";
  ntrp: string;
  location?: string;
  lat?: number;
  lng?: number;
}

const AuthContext = createContext<AuthState | null>(null);

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [isLoading, setIsLoading] = useState(true);

  /* Cache only the user object (no secret). The auth cookie is managed by the
     server. Passing null clears the cache. */
  const persist = useCallback((u: User | null) => {
    if (u) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_STORAGE_KEY);
    setUser(u);
  }, []);

  /* Clear the local cache and tell the server to expire the cookie. We clear
     locally regardless of the API outcome so the user is always logged out. */
  const logout = useCallback(() => {
    persist(null);
    authApi.logout().catch(() => {});
  }, [persist]);

  /* Revoke all sessions server-side, then clear locally. */
  const logoutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      persist(null);
    }
  }, [persist]);

  /* On mount: validate the session cookie via /me, hydrating the user (or
     clearing a stale cache if the cookie is gone). */
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then(({ user: fresh }) => {
        if (!cancelled) persist(fresh);
      })
      .catch(() => {
        if (!cancelled) persist(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [persist]);

  /* Global 401 handling (api/client dispatches 'auth:expired') + cross-tab
     logout. On 401 we only clear local state — the cookie is already gone. */
  useEffect(() => {
    const onExpired = () => persist(null);
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_STORAGE_KEY && e.newValue === null) {
        setUser(null);
      }
    };
    window.addEventListener("auth:expired", onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth:expired", onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [persist]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: u } = await authApi.login({ email, password });
      persist(u);
      return u;
    },
    [persist]
  );

  const signup = useCallback(
    async (data: SignupInput) => {
      const { user: u } = await authApi.signup(data);
      persist(u);
      return u;
    },
    [persist]
  );

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const { user: fresh } = await authApi.updateMe(patch);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
    setUser(fresh);
    return fresh;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout,
      logoutEverywhere,
      updateProfile,
    }),
    [user, isLoading, login, signup, logout, logoutEverywhere, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
