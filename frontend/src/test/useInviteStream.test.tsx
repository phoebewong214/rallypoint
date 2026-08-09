import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useInviteStream } from "../hooks/useInviteStream";

/* Minimal EventSource stand-in so we can fire lifecycle events by hand. jsdom
   has no EventSource; the hook only uses onopen/onmessage/onerror + close(). */
class MockEventSource {
  static instances: MockEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  url: string;
  withCredentials: boolean;
  readyState = MockEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = !!init?.withCredentials;
    MockEventSource.instances.push(this);
  }
  open() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }
  message(data: string) {
    this.onmessage?.({ data });
  }
  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }
}

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useInviteStream", () => {
  let qc: QueryClient;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    qc = new QueryClient();
    spy = vi.spyOn(qc, "invalidateQueries");
  });
  afterEach(() => {
    delete (globalThis as any).EventSource;
    vi.useRealTimers();
  });

  const keysInvalidated = () =>
    spy.mock.calls.map((c) => (c[0] as any)?.queryKey?.[0]);

  it("does not connect when disabled", () => {
    renderHook(() => useInviteStream(false), { wrapper: wrapper(qc) });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("connects with credentials to the stream URL when enabled", () => {
    renderHook(() => useInviteStream(true), { wrapper: wrapper(qc) });
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.withCredentials).toBe(true);
    expect(es.url).toMatch(/\/stream$/);
  });

  it("invalidates invites AND sessions on EVERY open (covers fresh login, not just reconnect)", () => {
    renderHook(() => useInviteStream(true), { wrapper: wrapper(qc) });
    const es = MockEventSource.instances[0];
    es.open(); // first connect of the session
    expect(keysInvalidated()).toEqual(expect.arrayContaining(["invites", "sessions"]));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("invalidates on an 'invites' message and ignores unrelated/malformed frames", () => {
    renderHook(() => useInviteStream(true), { wrapper: wrapper(qc) });
    const es = MockEventSource.instances[0];
    es.open();
    spy.mockClear();

    es.message(JSON.stringify({ type: "invites" }));
    expect(spy).toHaveBeenCalledTimes(2); // invites + sessions

    spy.mockClear();
    es.message(JSON.stringify({ type: "something-else" }));
    es.message("not json at all {");
    expect(spy).not.toHaveBeenCalled();
  });

  it("closes the EventSource on unmount", () => {
    const { unmount } = renderHook(() => useInviteStream(true), { wrapper: wrapper(qc) });
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("re-creates the connection after the browser gives up (readyState CLOSED)", () => {
    vi.useFakeTimers();
    renderHook(() => useInviteStream(true), { wrapper: wrapper(qc) });
    const es = MockEventSource.instances[0];
    es.readyState = MockEventSource.CLOSED;
    es.onerror?.();
    // The 30s reconnect timer should spin up a fresh EventSource.
    vi.advanceTimersByTime(30_000);
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
  });
});
