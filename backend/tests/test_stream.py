"""
SSE push channel (GET /api/stream): endpoint smoke tests + the invite write
routes' publish wiring. The stream is read step-by-step straight off the
response iterator (buffered=False) — no threads needed, because the generator
only advances when the test pulls the next chunk.
"""
import json
import queue
from datetime import datetime, timedelta

from services.stream import broker, CLOSE, MAX_STREAMS_PER_USER

# Future-relative times so the "must be in the future" validation keeps passing.
_base = (datetime.utcnow() + timedelta(days=60)).replace(hour=18, minute=0, second=0, microsecond=0)
_START = _base.isoformat()
_COUNTER = (_base + timedelta(hours=1)).isoformat()


def _signup(client, email):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": "Tennis", "ntrp": "3.5"})
    assert r.status_code == 201, r.get_json()
    b = r.get_json()
    return b["token"], b["user"]["id"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _text(chunk) -> str:
    return chunk.decode() if isinstance(chunk, (bytes, bytearray)) else chunk


def _drain(q):
    """Everything currently queued, parsed."""
    out = []
    while True:
        try:
            out.append(json.loads(q.get_nowait()))
        except queue.Empty:
            return out


def test_stream_requires_auth(client):
    assert client.get("/api/stream").status_code == 401


def test_stream_connects_delivers_heartbeats_and_cleans_up(client, app):
    app.config["STREAM_HEARTBEAT_SECONDS"] = 0.05  # keep the idle wait fast
    t, uid = _signup(client, "sse@rally.app")

    rsp = client.get("/api/stream", headers=_h(t), buffered=False)
    assert rsp.status_code == 200
    assert rsp.mimetype == "text/event-stream"
    assert rsp.headers["Cache-Control"] == "no-cache"

    it = iter(rsp.response)
    assert _text(next(it)).startswith("retry:")  # reconnect hint opens the stream
    assert broker.subscriber_count(uid) == 1

    broker.publish(uid, {"type": "invites"})
    assert _text(next(it)) == 'data: {"type": "invites"}\n\n'

    # Nothing queued → the next chunk is the keepalive comment.
    assert _text(next(it)) == ": keepalive\n\n"

    rsp.close()  # client disconnects → subscription must be reaped
    assert broker.subscriber_count(uid) == 0


def test_head_request_does_not_leak_a_subscription(client):
    # Flask auto-registers HEAD for GET routes; a HEAD response body is never
    # iterated, so the stream generator must never subscribe for it (else the
    # queue leaks — there's no iteration to reach the unsubscribing finally).
    t, uid = _signup(client, "head@rally.app")
    assert broker.subscriber_count(uid) == 0
    for _ in range(5):
        rsp = client.open("/api/stream", method="HEAD", headers=_h(t))
        assert rsp.status_code == 200
        rsp.close()
    assert broker.subscriber_count(uid) == 0


def test_per_user_stream_cap_evicts_the_oldest(client):
    t, uid = _signup(client, "cap@rally.app")
    qs = [broker.subscribe(uid) for _ in range(MAX_STREAMS_PER_USER + 2)]
    try:
        # Never more than the cap held at once, no matter how many connect.
        assert broker.subscriber_count(uid) == MAX_STREAMS_PER_USER
        # The two oldest were evicted and woken with CLOSE so their generators
        # break out and unsubscribe.
        assert qs[0].get_nowait() is CLOSE
        assert qs[1].get_nowait() is CLOSE
    finally:
        for q in qs:
            broker.unsubscribe(uid, q)


def test_happy_path_transitions_push_to_both_parties(client):
    ta, aid = _signup(client, "push_a@rally.app")
    tb, bid = _signup(client, "push_b@rally.app")
    qa, qb = broker.subscribe(aid), broker.subscribe(bid)
    try:
        r = client.post("/api/invites", headers=_h(ta),
                        json={"inviteeId": bid, "sport": "Tennis", "startAt": _START})
        assert r.status_code == 201, r.get_json()
        inv = r.get_json()["invite"]["id"]
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]

        assert client.post(f"/api/invites/{inv}/confirm-opponent", headers=_h(tb)).status_code == 200
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]

        assert client.post(f"/api/invites/{inv}/propose-time", headers=_h(tb),
                           json={"startAt": _COUNTER}).status_code == 200
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]

        assert client.post(f"/api/invites/{inv}/accept-time", headers=_h(ta)).status_code == 200
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]
    finally:
        broker.unsubscribe(aid, qa)
        broker.unsubscribe(bid, qb)


def test_decline_and_cancel_push_to_both_parties(client):
    ta, aid = _signup(client, "end_a@rally.app")
    tb, bid = _signup(client, "end_b@rally.app")
    qa, qb = broker.subscribe(aid), broker.subscribe(bid)
    try:
        r = client.post("/api/invites", headers=_h(ta),
                        json={"inviteeId": bid, "sport": "Tennis", "startAt": _START})
        first = r.get_json()["invite"]["id"]
        _drain(qa), _drain(qb)  # discard the create nudges

        assert client.post(f"/api/invites/{first}/decline", headers=_h(tb),
                           json={"reason": "busy"}).status_code == 200
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]

        # First invite is dead, so the same pair can start another — cancel it.
        r = client.post("/api/invites", headers=_h(ta),
                        json={"inviteeId": bid, "sport": "Tennis", "startAt": _START})
        second = r.get_json()["invite"]["id"]
        _drain(qa), _drain(qb)

        assert client.post(f"/api/invites/{second}/cancel", headers=_h(ta)).status_code == 200
        assert _drain(qa) == [{"type": "invites"}]
        assert _drain(qb) == [{"type": "invites"}]
    finally:
        broker.unsubscribe(aid, qa)
        broker.unsubscribe(bid, qb)


def test_publish_failure_never_breaks_the_write(client, monkeypatch):
    ta, aid = _signup(client, "boom_a@rally.app")
    tb, bid = _signup(client, "boom_b@rally.app")
    monkeypatch.setattr(broker, "publish",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("broker down")))
    r = client.post("/api/invites", headers=_h(ta),
                    json={"inviteeId": bid, "sport": "Tennis", "startAt": _START})
    assert r.status_code == 201  # invite still created
