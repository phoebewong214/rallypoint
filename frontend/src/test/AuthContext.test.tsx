import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";

import { AuthProvider, useAuth } from "../contexts/AuthContext";

/* Mock the API client so tests don't hit a live backend. */
vi.mock("../api/auth", () => ({
  authApi: {
    login: vi.fn(async ({ email }: { email: string }) => ({
      user: { id: "1", name: "Test User", initials: "TU", email },
      token: "fake.jwt.token",
    })),
    signup: vi.fn(async ({ email, name }: any) => ({
      user: { id: "2", name, initials: name[0], email },
      token: "fake.jwt.token",
    })),
    // No session cookie by default → /me rejects on mount.
    me: vi.fn(async () => {
      throw new Error("401");
    }),
    logout: vi.fn(async () => ({ ok: true })),
    logoutAll: vi.fn(async () => ({ ok: true })),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unauthenticated when there is no session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("login() caches the user and sets isAuthenticated (no token in storage)", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("test@rally.app", "rally1234");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe("Test User");
    // The JWT lives in an httpOnly cookie, never in localStorage.
    expect(localStorage.getItem("rallypoint.token")).toBeNull();
    expect(localStorage.getItem("rallypoint.user")).not.toBeNull();
  });

  it("logout() clears the user cache and calls the logout endpoint", async () => {
    const { authApi } = await import("../api/auth");
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("test@rally.app", "rally1234");
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("rallypoint.user")).toBeNull();
    expect((authApi.logout as any)).toHaveBeenCalled();
  });

  it("'auth:expired' window event triggers logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("test@rally.app", "rally1234");
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
  });
});
