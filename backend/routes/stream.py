"""
SSE push channel.

  GET /api/stream    long-lived text/event-stream; emits {"type": "invites"}
                     nudges published by the invite write routes, plus a
                     keepalive comment every STREAM_HEARTBEAT_SECONDS.

Auth is the same httpOnly-cookie flow as every other endpoint (EventSource
can't set headers, but withCredentials sends the cookie; Bearer still works
for API/test clients). Events carry no business data — clients refetch through
the normal query path — so the stream itself never leaks anything.
"""
import queue

from flask import Blueprint, Response, current_app

from extensions import limiter
from services.stream import broker, CLOSE
from utils.decorators import require_auth, current_user

stream_bp = Blueprint("stream", __name__)


@stream_bp.get("")
@require_auth
@limiter.exempt  # one connection can outlive any per-minute window
def stream():
    user_id = current_user().id
    heartbeat = float(current_app.config.get("STREAM_HEARTBEAT_SECONDS", 15))

    # Deliberately NOT stream_with_context: the request/app context (and with it
    # the SQLAlchemy session + its DB connection) is torn down as soon as this
    # view returns, so an open stream never pins a connection-pool slot. The
    # generator must therefore never touch the DB, request, or current_app.
    def gen():
        # Subscribe INSIDE the generator, not in the view body: a response whose
        # body is never iterated (notably HEAD, which Flask auto-registers for
        # GET routes) would otherwise subscribe but never reach the `finally`
        # that unsubscribes — leaking a queue per request. Here, no iteration =
        # no subscribe = nothing to clean up.
        q = broker.subscribe(user_id)
        try:
            # Reconnect hint for the browser (also serves as an immediate first
            # byte, which makes proxy buffering problems visible right away).
            yield "retry: 5000\n\n"
            while True:
                try:
                    payload = q.get(timeout=heartbeat)
                except queue.Empty:
                    # SSE comment — keeps proxies/LBs from idling the socket
                    # out; browsers ignore it. Doubles as the dead-connection
                    # probe: writing to a gone peer raises and cleans us up.
                    yield ": keepalive\n\n"
                    continue
                if payload is CLOSE:
                    break  # evicted (a newer stream took our per-user slot)
                yield f"data: {payload}\n\n"
        finally:
            broker.unsubscribe(user_id, q)

    resp = Response(gen(), mimetype="text/event-stream")
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["X-Accel-Buffering"] = "no"  # ask proxies not to buffer the stream
    return resp
