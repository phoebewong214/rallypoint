"""
Per-game chat (GET/POST /api/invites/<id>/messages): participant-only access,
confirmed-phase gating, body validation, the incremental `after` read, and the
publish wiring that nudges both parties' SSE streams.
"""
import json
import queue
from datetime import datetime, timedelta

from extensions import db
from models import GameInvite, Message
from models.game_invite import PHASE_AWAITING, PHASE_CANCELLED, PHASE_CONFIRMED
from routes.invites import CHAT_PAGE_LIMIT
from services.stream import broker

# Future-relative so the "must be in the future" invite validation keeps passing.
_START = (datetime.utcnow() + timedelta(days=60)).replace(
    hour=18, minute=0, second=0, microsecond=0).isoformat()


def _signup(client, email):
    r = client.post("/api/auth/signup", json={
        "email": email, "password": "rally1234", "name": email.split("@")[0].title(),
        "sport": "Tennis", "ntrp": "3.5"})
    assert r.status_code == 201, r.get_json()
    b = r.get_json()
    return b["token"], b["user"]["id"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def _invite(aid, bid, phase=PHASE_CONFIRMED):
    inv = GameInvite(inviter_id=aid, invitee_id=bid, sport="Tennis", phase=phase)
    db.session.add(inv)
    db.session.commit()
    return inv


def _drain(q):
    out = []
    while True:
        try:
            out.append(json.loads(q.get_nowait()))
        except queue.Empty:
            return out


def test_messages_require_auth(client):
    assert client.get("/api/invites/1/messages").status_code == 401
    assert client.post("/api/invites/1/messages", json={"body": "hi"}).status_code == 401


def test_missing_invite_is_404(client):
    t, _ = _signup(client, "chat_missing@rally.app")
    assert client.get("/api/invites/9999/messages", headers=_h(t)).status_code == 404


def test_non_participant_gets_the_same_404(client):
    ta, aid = _signup(client, "chat_np_a@rally.app")
    _, bid = _signup(client, "chat_np_b@rally.app")
    tc, _ = _signup(client, "chat_np_c@rally.app")
    inv = _invite(aid, bid)
    # The thread must not even confirm it exists to an outsider.
    assert client.get(f"/api/invites/{inv.id}/messages", headers=_h(tc)).status_code == 404
    assert client.post(f"/api/invites/{inv.id}/messages", headers=_h(tc),
                       json={"body": "let me in"}).status_code == 404
    # ...while a participant sails through.
    assert client.get(f"/api/invites/{inv.id}/messages", headers=_h(ta)).status_code == 200


def test_send_gated_to_confirmed_phase(client):
    ta, aid = _signup(client, "chat_gate_a@rally.app")
    _, bid = _signup(client, "chat_gate_b@rally.app")
    open_inv = _invite(aid, bid, phase=PHASE_AWAITING)
    r = client.post(f"/api/invites/{open_inv.id}/messages", headers=_h(ta),
                    json={"body": "too early"})
    assert r.status_code == 409
    dead = _invite(aid, bid, phase=PHASE_CANCELLED)
    assert client.post(f"/api/invites/{dead.id}/messages", headers=_h(ta),
                       json={"body": "too late"}).status_code == 409


def test_body_validation(client):
    ta, aid = _signup(client, "chat_val_a@rally.app")
    _, bid = _signup(client, "chat_val_b@rally.app")
    inv = _invite(aid, bid)
    url = f"/api/invites/{inv.id}/messages"
    assert client.post(url, headers=_h(ta), json={}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"body": ""}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"body": "   \n\t "}).status_code == 422
    assert client.post(url, headers=_h(ta), json={"body": "x" * 1001}).status_code == 422
    # Exactly at the cap (after strip) is fine, and padding is stripped off.
    r = client.post(url, headers=_h(ta), json={"body": "  " + "x" * 1000 + "  "})
    assert r.status_code == 201
    assert r.get_json()["message"]["body"] == "x" * 1000


def test_send_and_read_roundtrip(client):
    ta, aid = _signup(client, "chat_rt_a@rally.app")
    tb, bid = _signup(client, "chat_rt_b@rally.app")
    inv = _invite(aid, bid)
    url = f"/api/invites/{inv.id}/messages"

    r = client.post(url, headers=_h(ta), json={"body": "I'll bring balls"})
    assert r.status_code == 201
    sent = r.get_json()["message"]
    assert sent["mine"] is True and sent["senderId"] == aid
    assert sent["inviteId"] == inv.id and sent["createdAt"].endswith("+00:00")

    assert client.post(url, headers=_h(tb), json={"body": "see you at 6"}).status_code == 201

    # B reads the thread: ascending, viewer-relative `mine`.
    msgs = client.get(url, headers=_h(tb)).get_json()["messages"]
    assert [m["body"] for m in msgs] == ["I'll bring balls", "see you at 6"]
    assert [m["mine"] for m in msgs] == [False, True]
    assert msgs[0]["senderName"] == "Chat_Rt_A"


def test_after_returns_only_newer_messages(client):
    ta, aid = _signup(client, "chat_after_a@rally.app")
    tb, bid = _signup(client, "chat_after_b@rally.app")
    inv = _invite(aid, bid)
    url = f"/api/invites/{inv.id}/messages"
    ids = []
    for body in ("one", "two", "three"):
        ids.append(client.post(url, headers=_h(ta),
                               json={"body": body}).get_json()["message"]["id"])
    msgs = client.get(f"{url}?after={ids[0]}", headers=_h(tb)).get_json()["messages"]
    assert [m["body"] for m in msgs] == ["two", "three"]
    # `after` the newest id → an empty increment, not an error.
    assert client.get(f"{url}?after={ids[-1]}", headers=_h(tb)).get_json()["messages"] == []


def test_full_read_caps_at_latest_page(client):
    ta, aid = _signup(client, "chat_cap_a@rally.app")
    tb, bid = _signup(client, "chat_cap_b@rally.app")
    inv = _invite(aid, bid)
    total = CHAT_PAGE_LIMIT + 5
    db.session.add_all(Message(invite_id=inv.id, sender_id=aid, body=f"m{i}")
                       for i in range(total))
    db.session.commit()
    msgs = client.get(f"/api/invites/{inv.id}/messages", headers=_h(tb)).get_json()["messages"]
    # The LATEST page, still oldest-first: the first 5 fell off the front.
    assert len(msgs) == CHAT_PAGE_LIMIT
    assert msgs[0]["body"] == "m5" and msgs[-1]["body"] == f"m{total - 1}"


def test_dead_phase_keeps_history_readable(client):
    ta, aid = _signup(client, "chat_hist_a@rally.app")
    tb, bid = _signup(client, "chat_hist_b@rally.app")
    inv = _invite(aid, bid)
    url = f"/api/invites/{inv.id}/messages"
    assert client.post(url, headers=_h(ta), json={"body": "rain check?"}).status_code == 201
    inv.phase = PHASE_CANCELLED
    db.session.commit()
    msgs = client.get(url, headers=_h(tb)).get_json()["messages"]
    assert [m["body"] for m in msgs] == ["rain check?"]
    assert client.post(url, headers=_h(tb), json={"body": "hello?"}).status_code == 409


def test_send_publishes_chat_nudge_to_both_parties(client):
    ta, aid = _signup(client, "chat_pub_a@rally.app")
    _, bid = _signup(client, "chat_pub_b@rally.app")
    inv = _invite(aid, bid)
    qa, qb = broker.subscribe(aid), broker.subscribe(bid)
    try:
        r = client.post(f"/api/invites/{inv.id}/messages", headers=_h(ta),
                        json={"body": "ping"})
        assert r.status_code == 201
        expected = [{"type": "chat", "inviteId": inv.id}]
        assert _drain(qa) == expected
        assert _drain(qb) == expected
    finally:
        broker.unsubscribe(aid, qa)
        broker.unsubscribe(bid, qb)


def test_publish_failure_never_breaks_the_send(client, monkeypatch):
    ta, aid = _signup(client, "chat_boom_a@rally.app")
    _, bid = _signup(client, "chat_boom_b@rally.app")
    inv = _invite(aid, bid)
    monkeypatch.setattr(broker, "publish",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("broker down")))
    r = client.post(f"/api/invites/{inv.id}/messages", headers=_h(ta),
                    json={"body": "still lands"})
    assert r.status_code == 201


def test_confirmed_session_row_carries_invite_id(client):
    """The chat entry lives on the confirmed card, which renders from the
    materialized sessions row — so that row must point back at its invite."""
    ta, aid = _signup(client, "chat_sess_a@rally.app")
    tb, bid = _signup(client, "chat_sess_b@rally.app")
    r = client.post("/api/invites", headers=_h(ta),
                    json={"inviteeId": bid, "sport": "Tennis", "startAt": _START})
    invite_id = r.get_json()["invite"]["id"]
    assert client.post(f"/api/invites/{invite_id}/accept-time",
                       headers=_h(tb)).status_code == 200

    rows = client.get("/api/sessions", headers=_h(ta)).get_json()["sessions"]
    confirmed = [s for s in rows if s["status"] == "confirmed"]
    assert confirmed and confirmed[0]["inviteId"] == invite_id

    # A legacy session (created directly, no invite) has no thread to point at.
    r = client.post("/api/sessions", headers=_h(ta),
                    json={"guestId": bid, "sport": "Pickleball", "scheduledAt": _START})
    assert r.status_code == 201
    rows = client.get("/api/sessions", headers=_h(ta)).get_json()["sessions"]
    legacy = [s for s in rows if s["sport"] == "Pickleball"]
    assert legacy and legacy[0]["inviteId"] is None
