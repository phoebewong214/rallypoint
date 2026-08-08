import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { STREAM_URL } from "../api/client";

/* Fallback polling cadence while the stream is down, and how long to wait
   before re-creating an EventSource the browser gave up on for good. */
const POLL_MS = 30_000;
const RECONNECT_MS = 30_000;

/** Real-time invite updates. Subscribes to the backend SSE channel
    (GET /api/stream, cookie auth) and, on every `invites` event, invalidates
    the ['invites'] and ['sessions'] queries — data flows through the normal
    query path, the stream only says "refetch now".

    Degradation ladder: EventSource retries transient drops natively; while the
    stream is down we poll the same invalidation every 30s; when the browser
    abandons the connection entirely (e.g. the server answered an error during
    a cold start) we re-create it every 30s. On any reconnect we invalidate
    once to catch whatever happened while offline. */
export function useInviteStream(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let everConnected = false;
    let disposed = false;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["invites"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
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
        if (everConnected) invalidate(); // catch up after an outage
        everConnected = true;
      };
      es.onmessage = (ev) => {
        try {
          if (JSON.parse(ev.data)?.type === "invites") invalidate();
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
