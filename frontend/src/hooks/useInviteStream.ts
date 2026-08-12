import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { STREAM_URL } from "../api/client";

/* Fallback polling cadence while the stream is down, and how long to wait
   before re-creating an EventSource the browser gave up on for good. */
const POLL_MS = 30_000;
const RECONNECT_MS = 30_000;

/** Real-time invite + chat updates. Subscribes to the backend SSE channel
    (GET /api/stream, cookie auth) and, on every `invites` event, invalidates
    the ['invites'] and ['sessions'] queries; a `chat` event invalidates just
    that game's ['chat', inviteId] thread — data flows through the normal
    query path, the stream only says "refetch now".

    Degradation ladder: EventSource retries transient drops natively; while the
    stream is down we poll the same invalidation every 30s; when the browser
    abandons the connection entirely (e.g. the server answered an error during
    a cold start) we re-create it every 30s. Every successful connect
    invalidates once, so a fresh login (or a reconnect after an outage) syncs
    to the current account's data instead of showing whatever the cache held. */
export function useInviteStream(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;

    const invalidateInvites = () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    };
    /* The catch-up sweep (poll fallback + every successful connect): everything
       the stream would have nudged, including any open chat thread — the
       ['chat'] prefix matches all ['chat', inviteId] queries. */
    const invalidate = () => {
      invalidateInvites();
      qc.invalidateQueries({ queryKey: ["chat"] });
    };
    const stopPolling = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    const startPolling = () => {
      if (pollTimer === null) pollTimer = window.setInterval(invalidate, POLL_MS);
    };

    const connect = () => {
      if (disposed) return;
      es = new EventSource(STREAM_URL, { withCredentials: true });
      es.onopen = () => {
        stopPolling();
        // Sync on every successful connect: this covers a plain reconnect after
        // an outage AND the first connect of a session (e.g. right after a
        // login), where the query cache may still hold the previous account's
        // — or simply stale — invites/sessions until something refetches.
        invalidate();
      };
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === "invites") {
            invalidateInvites();
          } else if (msg?.type === "chat" && typeof msg.inviteId === "number") {
            qc.invalidateQueries({ queryKey: ["chat", msg.inviteId] });
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      es.onerror = () => {
        startPolling();
        // CONNECTING = native auto-retry in progress; CLOSED = the browser
        // won't try again (non-200 response), so schedule our own attempt.
        if (es && es.readyState === EventSource.CLOSED) {
          es.close();
          es = null;
          if (reconnectTimer !== null) clearTimeout(reconnectTimer);
          reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      stopPolling();
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled, qc]);
}
