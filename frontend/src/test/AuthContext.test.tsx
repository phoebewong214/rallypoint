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
    me: vi.fn(async () => ({
      user: { id: "1", name: "Test User", initials: "TU", email: "x@y.com" },
    })),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unauthenticated when no token is cached", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("login() persists the user + token and sets isAuthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("test@rally.app", "rally1234");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe("Test User");
    expect(localStorage.getItem("rallypoint.token")).toBe("fake.jwt.token");
  });

  it("logout() clears user and token from storage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("test@rally.app", "rally1234");
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("rallypoint.token")).toBeNull();
    expect(localStorage.getItem("rallypoint.user")).toBeNull();
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
