/* ============================================================
   AuthContext — single source of truth for the logged-in user + JWT.
   On mount we restore the cached user and validate the token against
   /api/auth/me; if it's stale we silently log out.
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
import { TOKEN_STORAGE_KEY } from "../api/client";

const USER_STORAGE_KEY = "rallypoint.user";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupInput) => Promise<User>;
  logout: () => void;
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

  const persist = useCallback((u: User | null, token: string | null) => {
    if (u && token) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setUser(u);
  }, []);

  const logout = useCallback(() => persist(null, null), [persist]);

  /* On mount: if we have a token, validate it via /me. */
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then(({ user: fresh }) => {
        if (!cancelled) {
          // refresh cached user with the latest server-side data
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
          setUser(fresh);
        }
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  /* Cross-tab + global 401 handling: api/client dispatches 'auth:expired'. */
  useEffect(() => {
    const onExpired = () => logout();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY && e.newValue === null) {
        setUser(null);
      }
    };
    window.addEventListener("auth:expired", onExpired);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth:expired", onExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: u, token } = await authApi.login({ email, password });
      persist(u, token);
      return u;
    },
    [persist]
  );

  const signup = useCallback(
    async (data: SignupInput) => {
      const { user: u, token } = await authApi.signup(data);
      persist(u, token);
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
      updateProfile,
    }),
    [user, isLoading, login, signup, logout, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
