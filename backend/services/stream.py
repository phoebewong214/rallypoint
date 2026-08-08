"""
In-process pub/sub for the SSE push channel (GET /api/stream).

One broker instance per process. Each connected client owns a small Queue
registered under its user id; publishers drop a JSON payload into every queue
for the target user (multiple tabs = multiple queues). This deliberately needs
no Redis/broker infra: production runs a single gevent worker (render.yaml), so
every subscriber lives in the same process as every publisher.

Works under both concurrency models we run:
  - flask dev server (threads): queue.Queue/Lock are thread-safe primitives.
  - gunicorn -k gevent (greenlets): gevent's monkey-patching makes these same
    primitives cooperative, so a waiting q.get() yields to the event loop.

Events are minimal nudges, not data ({"type": "invites"}): clients react by
refetching through the normal authenticated query path, so nothing sensitive
ever rides the push channel and ordering/loss are harmless.

Per-user connection cap: /api/stream is rate-limit-exempt (a held stream would
trip any per-minute window), so subscribe() itself bounds how many concurrent
streams one account can hold — otherwise a single authenticated client could
open unbounded connections and exhaust the single worker. Past the cap the
OLDEST stream is evicted (its generator is woken with CLOSE and exits).
"""
import queue
import threading
from collections import OrderedDict

# A subscriber that stops draining (dead socket not yet reaped) hits this cap
# and further events are dropped — safe, because events only mean "refetch now"
# and the next delivered event (or the client's reconnect) catches them up.
_QUEUE_MAXSIZE = 16

# Max concurrent streams per user. Generous for real multi-tab use (browsers
# self-limit to ~6 connections/host anyway) while bounding abuse: one account
# can hold at most this many greenlets/fds/queues on the single worker.
MAX_STREAMS_PER_USER = 8

# Sentinel pushed into an evicted subscriber's queue to make its generator
# break out of the wait loop and unsubscribe. Distinct from any JSON payload
# (which is always a str), so the generator tells them apart by identity.
CLOSE = object()


class StreamBroker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        # user_id -> OrderedDict[queue -> None]; insertion order = age, so the
        # first key is the oldest stream (evicted first when over the cap).
        self._subscribers: dict[int, "OrderedDict[queue.Queue, None]"] = {}

    def subscribe(self, user_id: int) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=_QUEUE_MAXSIZE)
        evicted = None
        with self._lock:
            subs = self._subscribers.setdefault(user_id, OrderedDict())
            if len(subs) >= MAX_STREAMS_PER_USER:
                # Drop the oldest to make room; wake it (below) so it exits.
                evicted, _ = subs.popitem(last=False)
            subs[q] = None
        if evicted is not None:
            # Its queue receives no more publishes (already removed), so a
            # single slot is enough to deliver CLOSE. If it's somehow full
            # (idle streams are empty, so this is rare), the stream still frees
            # its slot when the client eventually disconnects.
            try:
                evicted.put_nowait(CLOSE)
            except queue.Full:
                pass
        return q

    def unsubscribe(self, user_id: int, q: queue.Queue) -> None:
        with self._lock:
            subs = self._subscribers.get(user_id)
            if subs is not None:
                subs.pop(q, None)
                if not subs:
                    del self._subscribers[user_id]

    def publish(self, user_id: int, event: dict) -> None:
        """Queue `event` for every open stream of `user_id` (no-op when none)."""
        import json

        payload = json.dumps(event)
        with self._lock:
            subs = self._subscribers.get(user_id)
            queues = list(subs.keys()) if subs else []
        for q in queues:
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass  # stale subscriber — dropping a nudge loses nothing

    def subscriber_count(self, user_id: int) -> int:
        with self._lock:
            subs = self._subscribers.get(user_id)
            return len(subs) if subs else 0


broker = StreamBroker()
