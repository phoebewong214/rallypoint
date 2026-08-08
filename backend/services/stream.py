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
"""
import json
import queue
import threading
from collections import defaultdict

# A subscriber that stops draining (dead socket not yet reaped) hits this cap
# and further events are dropped — safe, because events only mean "refetch now"
# and the next delivered event (or the client's reconnect) catches them up.
_QUEUE_MAXSIZE = 16


class StreamBroker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: dict[int, set[queue.Queue]] = defaultdict(set)

    def subscribe(self, user_id: int) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=_QUEUE_MAXSIZE)
        with self._lock:
            self._subscribers[user_id].add(q)
        return q

    def unsubscribe(self, user_id: int, q: queue.Queue) -> None:
        with self._lock:
            subs = self._subscribers.get(user_id)
            if subs is not None:
                subs.discard(q)
                if not subs:
                    del self._subscribers[user_id]

    def publish(self, user_id: int, event: dict) -> None:
        """Queue `event` for every open stream of `user_id` (no-op when none)."""
        payload = json.dumps(event)
        with self._lock:
            queues = list(self._subscribers.get(user_id, ()))
        for q in queues:
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass  # stale subscriber — dropping a nudge loses nothing

    def subscriber_count(self, user_id: int) -> int:
        with self._lock:
            return len(self._subscribers.get(user_id, ()))


broker = StreamBroker()
